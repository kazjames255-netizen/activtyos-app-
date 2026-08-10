"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { post } from "@/lib/api";
import { LIGHT_PALETTE } from "@/components/OperatorPage";
import { RobotAvatar, type RobotState } from "./RobotAvatar";
import { useMic, useTts } from "./voice";

// ─────────────────────────────────────────────────────────────────────────
// AI co-pilot — a conversational assistant with the ActivityOS robot as its
// face. Chats over the account's LIVE data (POST /api/ai/chat, read-only,
// role-scoped). The robot reacts (idle / thinking / talking / listening), reads
// answers aloud in the British co-pilot voice, takes voice input, and drops
// one-tap "jump to the right page" links under answers. Conversations are kept
// per-browser. Taking actions itself (message, mark paid…) is a backend add —
// see docs/ai-assistant-tooluse-handoff.md.
// ─────────────────────────────────────────────────────────────────────────

interface Msg { role: "user" | "assistant"; content: string }
type Kind = "operator" | "staff" | "parent" | "platform";
interface Chat { id: string; title: string; at: number; pinned?: boolean; msgs: Msg[] }

const uid = () => Math.random().toString(36).slice(2, 9);

// ── Empty-state suggestion chips, grouped by job ──────────────────────────
const STARTERS: Record<Kind, { label: string; icon: string; qs: string[] }[]> = {
  operator: [
    { label: "Today", icon: "📋", qs: ["Who's booked in today?", "Which sessions are running now?", "Is anyone not signed in yet?"] },
    { label: "Money", icon: "💷", qs: ["Which families still owe money?", "How much have I taken this week?", "What's outstanding right now?"] },
    { label: "Bookings", icon: "🎫", qs: ["How full are my upcoming sessions?", "Any bookings awaiting approval?", "How did bookings go this week?"] },
    { label: "Team", icon: "👷", qs: ["Who's working today?", "Any staff certificates expiring soon?"] },
    { label: "Grow", icon: "📣", qs: ["Which listings are filling fastest?", "Who are my repeat families?"] },
  ],
  staff: [
    { label: "Today", icon: "📋", qs: ["Who's expected in today?", "What's running this week?", "Who hasn't been signed in?"] },
    { label: "Tasks", icon: "✅", qs: ["What tasks are still open?", "Anything due today?"] },
  ],
  parent: [
    { label: "My family", icon: "👨‍👩‍👧", qs: ["What have my children got coming up?", "Do I owe anything at the moment?", "Do I have any store credit?"] },
  ],
  platform: [
    { label: "Overview", icon: "📊", qs: ["How many providers are on the platform?", "How are bookings split by status?", "Who joined recently?"] },
  ],
};

const BRIEF_PROMPT = "Give me a short briefing of what needs my attention today — the most important two or three things only, in a friendly sentence or two.";

// ── Jump-to-action deep-links inferred from an answer (operator/staff only) ──
const INTENTS: { re: RegExp; icon: string; label: string; view: string }[] = [
  { re: /\b(owe|owed|unpaid|outstanding|invoice|reconcile|voucher)\b/i, icon: "🧮", label: "Reconciliation", view: "reconciliation" },
  { re: /\b(booking|booked|approval|waitlist|refund|cancel)\b/i, icon: "🎫", label: "Bookings", view: "bookings" },
  { re: /\b(register|sign(ed)? in|attendance|on site|collected)\b/i, icon: "📋", label: "Register", view: "registers" },
  { re: /\b(message|remind|contact|chase|email them)\b/i, icon: "✉️", label: "Message families", view: "messages" },
  { re: /\b(task|to-?do|overdue task|due today)\b/i, icon: "✅", label: "Task manager", view: "tasks" },
  { re: /\b(staff|rota|shift|workforce)\b/i, icon: "👷", label: "Schedule", view: "schedule" },
  { re: /\b(dbs|certificate|compliance|expir|safeguard)\b/i, icon: "🛡️", label: "Compliance", view: "compliance" },
  { re: /\b(revenue|income|payout|takings?|profit|finance)\b/i, icon: "💷", label: "Finance", view: "finance" },
  { re: /\b(listing|spaces?|capacity|filling|places left)\b/i, icon: "🗂️", label: "Listings", view: "listings" },
];

function actionsFor(text: string, kind: Kind, portal: string) {
  if (kind !== "operator" && kind !== "staff") return [];
  const out: { icon: string; label: string; href: string }[] = [];
  for (const it of INTENTS) {
    if (it.re.test(text) && !out.some((o) => o.label === it.label)) out.push({ icon: it.icon, label: it.label, href: `/${portal}/${it.view}` });
    if (out.length >= 3) break;
  }
  return out;
}

// ── Actions the co-pilot can DO ─────────────────────────────────────────────
// Two paths: (1) client-detected, self-contained actions (task/calendar) it
// executes against existing endpoints on your confirm; (2) once the backend
// tool-use lands (docs/ai-assistant-tooluse-handoff.md), /api/ai/chat may return
// a `action:{id,tool,summary,args}` the model proposed — we show the same
// "are you sure?" card and the SERVER executes it (re-checking permissions) via
// POST /api/ai/act. Anything needing "which record" resolution goes this route.
type ProposedAction = { id?: string; tool: string; summary: string; args?: Record<string, unknown> };
type ActionDraft = { kind: "task" | "calendar"; title: string; due?: string; date?: string; time?: string };
function cleanActionTitle(t: string): string {
  return t
    .replace(/^\s*(please\s+|can you\s+|could you\s+)+/i, "")
    .replace(/^(add|create|make|set ?up|schedule|put|new|book|log)\s+(a|an|the)?\s*(new\s+)?(task|to-?do|reminder|calendar event|event|meeting|diary entry|entry)\s*(to|for|:|that says|about|called|named|reminding me to)?\s*/i, "")
    .replace(/^(remind me to|i need to|note to self:?)\s*/i, "")
    .replace(/\s*[.。]\s*$/, "")
    .trim();
}
function detectAction(text: string): ActionDraft | null {
  const low = text.toLowerCase();
  const verb = /\b(add|create|make|set ?up|schedule|put|new|book|log|remind)\b/.test(low);
  if (/\b(calendar|diary|meeting|event)\b/.test(low) && verb) {
    return { kind: "calendar", title: cleanActionTitle(text) || text.trim(), date: new Date().toISOString().slice(0, 10), time: "" };
  }
  if ((/\b(task|to-?do)\b/.test(low) && verb) || /^(remind me to|i need to|note to self)\b/.test(low)) {
    return { kind: "task", title: cleanActionTitle(text) || text.trim(), due: "" };
  }
  return null;
}

function followupsFor(text: string): string[] {
  const t = text.toLowerCase();
  if (/\b(owe|unpaid|outstanding|invoice)\b/.test(t)) return ["Who owes the most?", "How long have these been outstanding?"];
  if (/\b(booking|booked|session|spaces?)\b/.test(t)) return ["Break that down by listing", "How does this week compare to last?"];
  if (/\b(register|sign|attendance|on site)\b/.test(t)) return ["Who hasn't been signed in?", "How many are on site right now?"];
  if (/\b(staff|rota|shift|certificate)\b/.test(t)) return ["Who's off this week?", "Any certificates expiring soon?"];
  if (/\b(revenue|income|money|payout|takings?)\b/.test(t)) return ["Compare to last month", "Which listing earns the most?"];
  return ["Tell me more", "Break that down"];
}

// ── Lightweight markdown → nodes (bold, code, links, bullet + numbered lists) ─
function inlineHtml(s: string): string {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, '<code class="rounded bg-black/5 px-1 py-0.5 text-[12px]">$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a class="text-[var(--brand,#2f6bd8)] underline" href="$2" target="_blank" rel="noreferrer">$1</a>');
}
function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inlineHtml(it) }} />);
    blocks.push(list.ordered
      ? <ol key={blocks.length} className="my-1 ml-4 list-decimal space-y-0.5">{items}</ol>
      : <ul key={blocks.length} className="my-1 ml-4 list-disc space-y-0.5">{items}</ul>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const head = line.match(/^#{1,3}\s+(.*)$/);
    if (bullet) { if (!list || list.ordered) { flush(); list = { ordered: false, items: [] }; } list.items.push(bullet[1]); continue; }
    if (num) { if (!list || !list.ordered) { flush(); list = { ordered: true, items: [] }; } list.items.push(num[1]); continue; }
    flush();
    if (head) blocks.push(<div key={blocks.length} className="mt-1.5 mb-0.5 text-[13.5px] font-extrabold" dangerouslySetInnerHTML={{ __html: inlineHtml(head[1]) }} />);
    else if (line.trim()) blocks.push(<p key={blocks.length} className="my-0.5" dangerouslySetInnerHTML={{ __html: inlineHtml(line) }} />);
  }
  flush();
  return <div className="text-[13px] leading-relaxed">{blocks}</div>;
}

const GREETING: Record<Kind, string> = {
  operator: "Hi — I'm your ActivityOS co-pilot. Ask me anything about your day and I'll read it straight from your live data.",
  staff: "Hi — I'm your ActivityOS co-pilot. Ask me who's in, what's running, or what's still to do.",
  parent: "Hi — I'm your ActivityOS assistant. Ask me about your bookings, what's coming up, or anything you owe.",
  platform: "Hi — I'm your ActivityOS co-pilot. Ask me about providers, bookings and platform activity.",
};

export function AiAssistant({ kind }: { kind: Kind }) {
  const portal = (usePathname().split("/")[1] || "freelancer");
  const tts = useTts();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionDraft | null>(null);
  const [proposed, setProposed] = useState<ProposedAction | null>(null);
  const [actBusy, setActBusy] = useState(false);
  const [actError, setActError] = useState<string | null>(null);
  const [speakOn, setSpeakOn] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatId, setChatId] = useState(() => uid());
  const endRef = useRef<HTMLDivElement>(null);
  const handsFreeRef = useRef(handsFree);
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);
  const storeKey = `aos.ai.chats.v1.${kind}`;

  // ── History (per-browser) ───────────────────────────────────────────────
  // Hydrate after mount (keeps SSR markup and the client's first paint in step;
  // localStorage isn't available on the server).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const raw = localStorage.getItem(storeKey); if (raw) setChats(JSON.parse(raw)); } catch { /* ignore */ }
  }, [storeKey]);
  // Upsert the current conversation into history (called from send, not an
  // effect, so there's no cascading render).
  const persist = useCallback((m: Msg[]) => {
    if (!m.length) return;
    setChats((cur) => {
      const title = (m.find((x) => x.role === "user")?.content ?? "New chat").slice(0, 48);
      const existing = cur.find((c) => c.id === chatId);
      const rec: Chat = { id: chatId, title, at: Date.now(), pinned: existing?.pinned, msgs: m };
      const next = [rec, ...cur.filter((c) => c.id !== chatId)].slice(0, 40);
      try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [chatId, storeKey]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  const speakReply = useCallback((reply: string) => {
    if (!speakOn && !handsFreeRef.current) return;
    tts.speak(reply, () => { if (handsFreeRef.current) micRef.current?.start(); });
  }, [speakOn, tts]);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setError(null); setDraft(""); tts.cancel();
    // If they're asking me to DO something (task / calendar), open a confirm
    // card instead of answering read-only.
    const act = (kind === "operator" || kind === "staff") ? detectAction(q) : null;
    if (act) {
      const h = [...msgs, { role: "user" as const, content: q }].slice(-20);
      setMsgs(h); persist(h); setPendingAction(act); setActError(null);
      return;
    }
    const history = [...msgs, { role: "user" as const, content: q }].slice(-20);
    setMsgs(history); persist(history); setBusy(true);
    try {
      const res = await post<{ reply?: string; action?: ProposedAction }>("/api/ai/chat", { messages: history });
      const reply = res.reply ?? res.action?.summary ?? "";
      const full = [...history, { role: "assistant" as const, content: reply }];
      setMsgs(full); persist(full);
      if (res.action) setProposed(res.action);   // backend tool-use → confirm card
      if (reply) speakReply(reply);
    } catch (e) {
      setError((e as Error).message); setDraft(q);
    } finally { setBusy(false); }
  }, [busy, msgs, tts, speakReply, persist, kind]);

  const appendAssistant = useCallback((content: string) => {
    setMsgs((m) => { const next = [...m, { role: "assistant" as const, content }]; persist(next); return next; });
    if (speakOn || handsFreeRef.current) tts.speak(content);
  }, [persist, speakOn, tts]);

  // Run a confirmed action against the real (authed) endpoint.
  const runAction = useCallback(async () => {
    if (!pendingAction || actBusy) return;
    setActBusy(true); setActError(null);
    try {
      if (pendingAction.kind === "task") {
        await post("/api/tasks", { t: pendingAction.title, ...(pendingAction.due ? { due: pendingAction.due } : {}) });
        appendAssistant(`✅ Done — I've added the task "${pendingAction.title}"${pendingAction.due ? `, due ${pendingAction.due}` : ""} to your Task manager.`);
      } else {
        await post("/api/calendar-events", { title: pendingAction.title, date: pendingAction.date, ...(pendingAction.time ? { start: pendingAction.time } : { allDay: true }) });
        appendAssistant(`✅ Done — "${pendingAction.title}" is now in your calendar on ${pendingAction.date}.`);
      }
      setPendingAction(null);
    } catch (e) { setActError((e as Error).message); }
    finally { setActBusy(false); }
  }, [pendingAction, actBusy, appendAssistant]);

  // Confirm a server-proposed action (backend tool-use) — the server executes
  // it and re-checks permissions; we just relay the receipt.
  const confirmProposed = useCallback(async () => {
    if (!proposed || actBusy) return;
    setActBusy(true); setActError(null);
    try {
      const r = await post<{ reply?: string }>("/api/ai/act", { id: proposed.id, tool: proposed.tool, args: proposed.args });
      appendAssistant(r.reply ?? "✅ Done.");
      setProposed(null);
    } catch (e) { setActError((e as Error).message); }
    finally { setActBusy(false); }
  }, [proposed, actBusy, appendAssistant]);

  const mic = useMic((t) => { if (handsFreeRef.current) void send(t); else setDraft((d) => (d ? d + " " : "") + t); });
  const micRef = useRef(mic);
  useEffect(() => { micRef.current = mic; });

  const robotState: RobotState = busy ? "thinking" : tts.speaking ? "talking" : mic.listening ? "listening" : "idle";
  const status = busy ? "Thinking…" : tts.speaking ? "Speaking…" : mic.listening ? "Listening…" : "Ready when you are";

  const newChat = () => { tts.cancel(); setMsgs([]); setDraft(""); setError(null); setPendingAction(null); setProposed(null); setActError(null); setChatId(uid()); };
  const loadChat = (c: Chat) => { tts.cancel(); setMsgs(c.msgs); setChatId(c.id); setError(null); setPendingAction(null); setProposed(null); };
  const delChat = (id: string) => setChats((cur) => { const next = cur.filter((c) => c.id !== id); try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ } return next; });
  const pinChat = (id: string) => setChats((cur) => { const next = cur.map((c) => c.id === id ? { ...c, pinned: !c.pinned } : c); try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ } return next; });

  const toggleHandsFree = () => setHandsFree((v) => { const nv = !v; if (nv) { setSpeakOn(true); if (!mic.listening && !busy && !tts.speaking) mic.start(); } else { mic.stop(); } return nv; });

  const sortedChats = useMemo(() => [...chats].sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || b.at - a.at), [chats]);
  const last = msgs[msgs.length - 1];
  const showFollowups = last?.role === "assistant" && !busy;

  const toggle = (on: boolean, label: string, onClick: () => void, dis = false) => (
    <button type="button" onClick={onClick} disabled={dis}
      className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition disabled:opacity-40"
      style={on ? { borderColor: "transparent", background: "rgba(127,208,255,.22)", color: "#eaf2ff" } : { borderColor: "rgba(255,255,255,.25)", color: "rgba(234,242,255,.8)" }}>
      {label}
    </button>
  );

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 text-[var(--ink)] sm:-m-5 sm:p-5"
      style={{ ...LIGHT_PALETTE, background: "radial-gradient(120% 80% at 0% 0%, rgba(63,120,216,.12) 0%, transparent 50%), radial-gradient(110% 70% at 100% 0%, rgba(127,208,255,.10) 0%, transparent 46%), linear-gradient(180deg,#eaf1fc 0%,#f5f8fd 45%,#f4f8ff 100%)" }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-[20px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>AI co-pilot</h2>
          <p className="text-[12px] text-[var(--ink-3)]">Answers from your live data · read-only, it points you to the right screen for actions</p>
        </div>
        <button type="button" onClick={newChat} className="rounded-full bg-white px-4 py-2 text-[12.5px] font-extrabold text-[#1d3a8f] shadow-sm ring-1 ring-[var(--line)] transition hover:-translate-y-px">＋ New chat</button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[290px_1fr]">
        {/* Persona + history */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl p-4 text-center text-white shadow-[0_14px_36px_-16px_rgba(20,40,90,.7)]" style={{ background: "radial-gradient(120% 100% at 50% -10%, #24427f 0%, #0e1c3c 78%)" }}>
            <RobotAvatar state={robotState} size={132} className="mx-auto" />
            <div className="mt-1.5 text-[13.5px] font-extrabold">{status}</div>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {toggle(speakOn, speakOn ? "🔊 Voice on" : "🔊 Voice", () => { const nv = !speakOn; setSpeakOn(nv); if (!nv) { tts.cancel(); setHandsFree(false); } })}
              {mic.supported && toggle(handsFree, "🎙 Hands-free", toggleHandsFree)}
            </div>
            {(tts.speaking || busy) && (
              <button type="button" onClick={() => { tts.cancel(); }} className="mt-2 rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold text-white/90 hover:bg-white/20">■ Stop</button>
            )}
          </div>

          <div className="hidden min-h-0 flex-1 flex-col rounded-2xl border border-[var(--line)] bg-white p-2 lg:flex">
            <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Recent chats</div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {sortedChats.length === 0 && <div className="px-2 py-3 text-[11.5px] text-[var(--ink-3)]">Your conversations will appear here.</div>}
              {sortedChats.map((c) => (
                <div key={c.id} className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 ${c.id === chatId ? "bg-[var(--panel)] ring-1 ring-[var(--line)]" : "hover:bg-[var(--panel)]"}`}>
                  <button type="button" onClick={() => loadChat(c)} className="min-w-0 flex-1 truncate text-left text-[12px] font-semibold text-[var(--ink-2)]">{c.pinned ? "📌 " : ""}{c.title}</button>
                  <button type="button" onClick={() => pinChat(c.id)} title="Pin" className="opacity-0 group-hover:opacity-100 text-[11px] text-[var(--ink-3)]">📌</button>
                  <button type="button" onClick={() => delChat(c.id)} title="Delete" className="opacity-0 group-hover:opacity-100 text-[12px] text-[var(--ink-3)] hover:text-[#c02636]">×</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="flex min-h-[62vh] flex-col rounded-2xl border border-[var(--line)] bg-white shadow-[0_1px_3px_rgba(20,30,60,.06)]">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {msgs.length === 0 ? (
              <div className="mx-auto max-w-[560px] pt-4">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 text-center">
                  <p className="text-[13.5px] font-semibold text-[var(--ink)]">{GREETING[kind]}</p>
                  {(kind === "operator" || kind === "staff") && (
                    <button type="button" onClick={() => void send(BRIEF_PROMPT)} className="mt-3 rounded-full px-4 py-2 text-[13px] font-extrabold text-white shadow-sm" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>☀️ Brief me on today</button>
                  )}
                </div>
                <div className="mt-4 space-y-3">
                  {STARTERS[kind].map((g) => (
                    <div key={g.label}>
                      <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{g.icon} {g.label}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {g.qs.map((q) => (
                          <button key={q} type="button" onClick={() => void send(q)} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[12px] text-[var(--ink-2)] transition hover:border-[#2f6bd8] hover:text-[var(--ink)]">{q}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {msgs.map((m, i) => {
                  if (m.role === "user") return (
                    <div key={i} className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#eaf0fc] px-3.5 py-2 text-[13px] font-medium text-[#1d3a8f]">{m.content}</div></div>
                  );
                  const acts = actionsFor(m.content, kind, portal);
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <RobotAvatar state={busy && i === msgs.length - 1 ? "thinking" : tts.speaking && i === msgs.length - 1 ? "talking" : "idle"} size={34} className="mt-0.5 flex-none" />
                      <div className="max-w-[85%]">
                        <div className="rounded-2xl rounded-bl-md border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-[var(--ink)]"><RichText text={m.content} /></div>
                        {acts.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {acts.map((a) => (
                              <a key={a.href} href={a.href} className="inline-flex items-center gap-1.5 rounded-full border border-[#cdddf7] bg-[#f2f7ff] px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f] no-underline transition hover:bg-[#e7f0ff]"><span>{a.icon}</span>{a.label}<span className="text-[#7fa8e8]">→</span></a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {busy && (
                  <div className="flex items-center gap-2.5"><RobotAvatar state="thinking" size={34} className="flex-none" /><div className="rounded-2xl rounded-bl-md border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-[12.5px] text-[var(--ink-3)]">Reading your live data…</div></div>
                )}
                {pendingAction && (
                  <div className="flex items-start gap-2.5">
                    <RobotAvatar state="idle" size={34} className="mt-0.5 flex-none" />
                    <div className="w-full max-w-[420px] rounded-2xl rounded-bl-md border border-[#cdddf7] bg-[#f6faff] p-3">
                      <div className="text-[12.5px] font-extrabold text-[#1d3a8f]">{pendingAction.kind === "task" ? "✅ Create this task?" : "🗓️ Add this to your calendar?"}</div>
                      <label className="mt-2 block text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Title
                        <input className="mt-0.5 w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-[var(--ink)] outline-none focus:border-[#2f6bd8]" value={pendingAction.title} onChange={(e) => setPendingAction((p) => (p ? { ...p, title: e.target.value } : p))} />
                      </label>
                      {pendingAction.kind === "task" ? (
                        <label className="mt-2 block text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Due (optional)
                          <input type="date" className="mt-0.5 w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" value={pendingAction.due ?? ""} onChange={(e) => setPendingAction((p) => (p ? { ...p, due: e.target.value } : p))} />
                        </label>
                      ) : (
                        <div className="mt-2 flex gap-2">
                          <label className="flex-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Date
                            <input type="date" className="mt-0.5 w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" value={pendingAction.date ?? ""} onChange={(e) => setPendingAction((p) => (p ? { ...p, date: e.target.value } : p))} />
                          </label>
                          <label className="flex-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Time (optional)
                            <input type="time" className="mt-0.5 w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" value={pendingAction.time ?? ""} onChange={(e) => setPendingAction((p) => (p ? { ...p, time: e.target.value } : p))} />
                          </label>
                        </div>
                      )}
                      {actError && <div className="mt-2 rounded-md border border-[#f6c9cc] bg-[#fdebec] px-2 py-1 text-[11.5px] text-[#c02636]">{actError}</div>}
                      <div className="mt-2.5 flex items-center gap-2">
                        <button type="button" onClick={() => void runAction()} disabled={actBusy || !pendingAction.title.trim() || (pendingAction.kind === "calendar" && !pendingAction.date)} className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-40" style={{ background: "linear-gradient(180deg,#33b06a,#127a3e)" }}>{actBusy ? "Working…" : pendingAction.kind === "task" ? "Create task" : "Add event"}</button>
                        <button type="button" onClick={() => { setPendingAction(null); setActError(null); }} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">Cancel</button>
                      </div>
                      <div className="mt-1.5 text-[10.5px] text-[var(--ink-3)]">I only create it when you click — edit the details first if you like.</div>
                    </div>
                  </div>
                )}
                {proposed && (
                  <div className="flex items-start gap-2.5">
                    <RobotAvatar state="idle" size={34} className="mt-0.5 flex-none" />
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-[#cdddf7] bg-[#f6faff] p-3">
                      <div className="text-[12.5px] font-extrabold text-[#1d3a8f]">Confirm this action?</div>
                      <div className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink)]">{proposed.summary}</div>
                      {actError && <div className="mt-2 rounded-md border border-[#f6c9cc] bg-[#fdebec] px-2 py-1 text-[11.5px] text-[#c02636]">{actError}</div>}
                      <div className="mt-2.5 flex items-center gap-2">
                        <button type="button" onClick={() => void confirmProposed()} disabled={actBusy} className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-40" style={{ background: "linear-gradient(180deg,#33b06a,#127a3e)" }}>{actBusy ? "Working…" : "Yes, do it"}</button>
                        <button type="button" onClick={() => { setProposed(null); setActError(null); }} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">Cancel</button>
                      </div>
                      <div className="mt-1.5 text-[10.5px] text-[var(--ink-3)]">Nothing happens until you confirm — the server runs it and checks you're allowed.</div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {error && <div className="mt-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{error}</div>}
            <div ref={endRef} />
          </div>

          {/* Follow-up chips */}
          {showFollowups && (
            <div className="flex flex-wrap gap-1.5 border-t border-[var(--line)] px-3 pt-2">
              {followupsFor(last.content).map((f) => (
                <button key={f} type="button" onClick={() => void send(f)} className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ink-2)] transition hover:border-[#2f6bd8] hover:text-[var(--ink)]">{f}</button>
              ))}
            </div>
          )}

          {/* Composer */}
          <div className="flex items-end gap-2 border-t border-[var(--line)] p-2.5">
            {mic.supported && (
              <button type="button" onClick={() => (mic.listening ? mic.stop() : mic.start())} title={mic.listening ? "Stop" : "Speak"}
                className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[16px] transition"
                style={mic.listening ? { background: "#ee1f63", color: "#fff", boxShadow: "0 0 0 4px rgba(238,31,99,.18)" } : { background: "var(--panel)", color: "var(--ink-2)", border: "1px solid var(--line)" }}>🎙</button>
            )}
            <textarea
              value={mic.listening && mic.interim ? mic.interim : draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(draft); } }}
              placeholder={mic.listening ? "Listening…" : "Ask about your day…  (Enter to send)"}
              rows={Math.min(5, Math.max(1, draft.split("\n").length))}
              className="max-h-[140px] min-h-[44px] flex-1 resize-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[13px] leading-[1.5] text-[var(--ink)] outline-none focus:border-[#2f6bd8]"
            />
            <button type="button" onClick={() => void send(draft)} disabled={!draft.trim() || busy} className="h-10 flex-none rounded-full px-4 text-[13px] font-extrabold text-white transition disabled:opacity-40" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
