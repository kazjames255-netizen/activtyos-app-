"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card, Input, Select } from "@/components/ui";

interface Thread {
  id: string;
  tenantId: string;
  tenantName?: string;
  parentEmail: string;
  parentName?: string;
  lastBody?: string;
  lastFrom?: "operator" | "parent";
  lastAt?: string;
  operatorUnread?: number;
  parentUnread?: number;
}
interface Message { id: string; from: "operator" | "parent"; senderName?: string; body: string; createdAt?: string }
interface Provider { tenantId: string; name: string }
interface Customer { id: string; name?: string; email?: string }

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export function MessagesApp({ mode }: { mode: "operator" | "parent" }) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [target, setTarget] = useState(""); // tenantId (parent) or customer email (operator)
  const endRef = useRef<HTMLDivElement>(null);
  const mine = mode === "operator" ? "operator" : "parent";

  const loadThreads = useCallback(() => {
    apiGet<Thread[]>("/api/messages/threads").then((t) => { setThreads(t); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  const loadThread = useCallback((id: string) => {
    apiGet<{ thread: Thread; messages: Message[] }>(`/api/messages/threads/${encodeURIComponent(id)}`).then((r) => { setMessages(r.messages); loadThreads(); }).catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [loadThreads]);

  useEffect(() => { loadThreads(); }, [loadThreads]);
  useEffect(() => {
    if (mode === "parent") apiGet<Provider[]>("/api/my/providers").then(setProviders).catch(() => {});
    else apiGet<Customer[]>("/api/customers").then((c) => setCustomers(c.filter((x) => x.email))).catch(() => {});
  }, [mode]);
  useRealtime(["threads", "messages"], () => { loadThreads(); if (openId) loadThread(openId); });
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages]);

  function open(id: string) { setComposing(false); setOpenId(id); loadThread(id); }

  async function send() {
    if (!draft.trim()) return;
    try {
      if (composing) {
        if (!target) { setError("Choose who to message."); return; }
        const payload = mode === "parent" ? { tenantId: target, body: draft } : { parentEmail: target, parentName: customers.find((c) => c.email === target)?.name, body: draft };
        const res = await apiPost<{ threadId: string }>("/api/messages", payload);
        setDraft(""); setComposing(false); setTarget(""); loadThreads(); open(res.threadId);
      } else {
        const t = threads?.find((x) => x.id === openId);
        if (!t) return;
        const payload = mode === "parent" ? { tenantId: t.tenantId, body: draft } : { parentEmail: t.parentEmail, parentName: t.parentName, body: draft };
        await apiPost("/api/messages", payload);
        setDraft(""); loadThread(t.id);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t send"); }
  }

  const active = threads?.find((t) => t.id === openId) ?? null;
  const other = (t: Thread) => (mode === "operator" ? t.parentName || t.parentEmail : t.tenantName || "Provider");
  const unread = (t: Thread) => (mode === "operator" ? t.operatorUnread : t.parentUnread) ?? 0;

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Messages</h2>
        <Button variant="primary" onClick={() => { setComposing(true); setOpenId(null); setMessages([]); }}>＋ New message</Button>
      </div>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      <div className="grid gap-3 md:grid-cols-[280px_1fr]">
        <Card className="p-1.5">
          {!threads ? <div className="p-4 text-center text-[12px] text-[var(--ink-3)]">Loading…</div>
          : threads.length === 0 ? <div className="p-4 text-center text-[12px] text-[var(--ink-3)]">No conversations yet.</div>
          : (
            <div className="flex flex-col">
              {threads.map((t) => (
                <button key={t.id} type="button" onClick={() => open(t.id)} className={`flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition ${openId === t.id ? "bg-[var(--panel)]" : "hover:bg-[var(--panel)]"}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold">{other(t)}</span>
                    {unread(t) > 0 && <Badge tone={{ bg: "var(--brand)", fg: "#fff" }}>{unread(t)}</Badge>}
                  </div>
                  <div className="truncate text-[11.5px] text-[var(--ink-3)]">{t.lastFrom === mine ? "You: " : ""}{t.lastBody}</div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex min-h-[420px] flex-col p-0">
          {composing ? (
            <div className="flex flex-1 flex-col">
              <div className="border-b border-[var(--line)] p-3">
                <div className="mb-1.5 text-[12px] font-bold text-[var(--ink-3)]">{mode === "parent" ? "Message a provider you’ve booked" : "Message a family"}</div>
                <Select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full">
                  <option value="">Choose…</option>
                  {mode === "parent"
                    ? providers.map((p) => <option key={p.tenantId} value={p.tenantId}>{p.name}</option>)
                    : customers.map((c) => <option key={c.id} value={c.email}>{c.name} · {c.email}</option>)}
                </Select>
              </div>
              <div className="flex-1" />
              <Composer draft={draft} setDraft={setDraft} onSend={send} />
            </div>
          ) : !active ? (
            <div className="flex flex-1 items-center justify-center text-[12.5px] text-[var(--ink-3)]">Pick a conversation, or start a new one.</div>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="border-b border-[var(--line)] px-3.5 py-2.5 text-[13px] font-extrabold">{other(active)}</div>
              <div className="flex-1 overflow-y-auto p-3.5">
                <div className="flex flex-col gap-2">
                  {messages.map((m) => (
                    <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-[13px] ${m.from === mine ? "self-end bg-[var(--brand)] text-white" : "self-start bg-[var(--panel)] text-[var(--ink)]"}`}>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                      <div className={`mt-0.5 text-[10px] ${m.from === mine ? "text-white/70" : "text-[var(--ink-3)]"}`}>{when(m.createdAt)}</div>
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
              </div>
              <Composer draft={draft} setDraft={setDraft} onSend={send} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Composer({ draft, setDraft, onSend }: { draft: string; setDraft: (v: string) => void; onSend: () => void }) {
  return (
    <div className="flex items-center gap-2 border-t border-[var(--line)] p-2.5">
      <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }} placeholder="Write a message…" className="flex-1" />
      <Button variant="primary" onClick={onSend} disabled={!draft.trim()}>Send</Button>
    </div>
  );
}
