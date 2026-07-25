"use client";

import { useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";

// ── HQ Support & messages (front-end only for now) ──────────────────────────
// One inbox where HQ talks to providers (by tier) and to a provider's customers
// when they need help with a bug. Reported bugs land here with the details the
// reporter's device/page pulled over. Runs on a localStorage demo store so it
// fully works and demos; the data model maps 1:1 to the backend Amir will build
// (see docs/support-inbox-handoff.md). Platform-role only.

type Tier = "freelancer" | "company" | "franchise";
type Party = "provider" | "customer";
interface Msg { id: string; from: "hq" | "them"; body: string; at: string }
interface Report { channel: string; page: string; severity: "low" | "medium" | "high"; device: string; steps: string }
interface Thread {
  id: string; party: Party; name: string; email: string;
  tier: Tier;                       // provider's own tier, or the linked provider's tier
  providerName: string;             // for a customer: who they book with; for a provider: themselves
  subject: string;
  kind: "message" | "bug";
  report?: Report;                  // present on bug threads — the "pulled over" details
  status: "open" | "resolved";
  unread: boolean;                  // unread by HQ
  messages: Msg[];
  createdAt: string; updatedAt: string;
}

const HERO = "radial-gradient(120% 160% at 12% -30%, rgba(120,170,255,.5) 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)";
const TIERS: Record<Tier, { label: string; bg: string; fg: string }> = {
  freelancer: { label: "Freelancer", bg: "#eef2fb", fg: "#3f5bb3" },
  company: { label: "Company", bg: "#eaf0fc", fg: "#1d3a8f" },
  franchise: { label: "Franchise", bg: "#efeaff", fg: "#6d28d9" },
};
const SEV: Record<Report["severity"], { label: string; bg: string; fg: string }> = {
  high: { label: "High", bg: "#fdebec", fg: "#c02636" },
  medium: { label: "Medium", bg: "#fdf0e3", fg: "#a5670a" },
  low: { label: "Low", bg: "#eef0f5", fg: "#6b6880" },
};
const GRADS = ["linear-gradient(135deg,#1d3a8f,#3f78d8)", "linear-gradient(135deg,#3f78d8,#5aa0f0)", "linear-gradient(135deg,#274ba3,#4f8bf5)", "linear-gradient(135deg,#6d28d9,#a855f7)"];
const initials = (s: string) => (s.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?");
const grad = (s: string) => GRADS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADS.length];
const uid = () => { try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.round(Math.random() * 1e6)}`; } };
const nowIso = () => new Date().toISOString();
const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};
const KEY = "aos.support.threads.v1";
const loadThreads = (): Thread[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const saveThreads = (t: Thread[]) => { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* ignore */ } };

const ago = (days: number, mins = 0) => new Date(Date.now() - days * 86400000 - mins * 60000).toISOString();
function seed(
  party: Party, name: string, email: string, tier: Tier, providerName: string, subject: string,
  kind: Thread["kind"], report: Report | undefined, status: Thread["status"], unread: boolean,
  msgs: [Msg["from"], string, string][],
): Thread {
  const messages = msgs.map(([from, body, at]) => ({ id: uid(), from, body, at }));
  const createdAt = messages[0]?.at ?? nowIso();
  const updatedAt = messages[messages.length - 1]?.at ?? createdAt;
  return { id: uid(), party, name, email, tier, providerName, subject, kind, report, status, unread, messages, createdAt, updatedAt };
}
const SEED: Thread[] = [
  seed("provider", "Riverdale Rugby Camps", "tom@riverdale.example", "company", "Riverdale Rugby Camps",
    "Bookings export throws an error", "bug",
    { channel: "In-app bug report", page: "Bookings → Export", severity: "high", device: "Chrome 141 · Windows", steps: "Filter to this month, click Export CSV → red error toast, nothing downloads." },
    "open", true,
    [["them", "Tried exporting this month's bookings and it just errors. Screenshot attached in the report.", ago(0, 40)]]),
  seed("customer", "Sara Whitfield", "sara.w@example.com", "company", "Little Kickers North",
    "Can't complete checkout", "bug",
    { channel: "In-app bug report", page: "Checkout → Payment", severity: "high", device: "Safari · iPhone", steps: "Add Saturday session to basket, enter card, tap Pay → spinner never stops." },
    "open", true,
    [["them", "I'm trying to book my son onto Little Kickers North and the payment just spins forever. Can you help?", ago(0, 95)]]),
  seed("provider", "Little Kickers North", "sara@lkn.example", "franchise", "Little Kickers North",
    "Adding a 5th site to our plan", "message", undefined, "open", false,
    [["them", "We're opening a 5th venue next month — how do we add it and what's the cost?", ago(1, 30)],
     ["hq", "Great news! On the franchise plan each extra site is +75% of the base. I can add it now — want me to schedule it for the 1st?", ago(1, 10)]]),
  seed("provider", "Bounce Gymnastics", "dan@bounce.example", "freelancer", "Bounce Gymnastics",
    "Question about my invoice", "message", undefined, "open", true,
    [["them", "My last invoice looks higher than usual — is that the extra staff seat?", ago(2, 15)]]),
  seed("provider", "Spark Drama School", "mia@spark.example", "company", "Spark Drama School",
    "Calendar showed wrong week", "bug",
    { channel: "Inbound email", page: "Timetable", severity: "medium", device: "Firefox · Mac", steps: "Timetable opened on last week instead of today after login. Refreshed and it fixed itself." },
    "resolved", false,
    [["them", "The timetable kept opening on the wrong week this morning.", ago(4, 0)],
     ["hq", "Thanks — this was a caching issue we've now patched. Let us know if it comes back.", ago(3, 60)]]),
  seed("customer", "Owen Pratt", "owen.p@example.com", "company", "Aqua Tots Swim",
    "Refund not showing", "message", undefined, "open", false,
    [["them", "Aqua Tots cancelled my Tuesday class and said I'd get wallet credit — I can't see it yet.", ago(3, 20)],
     ["hq", "Passed this to Aqua Tots to confirm the credit; you should see it within 24h.", ago(3, 5)]]),
];

interface Provider { id: string; name: string; type: string; contactEmail: string | null; ownerEmail: string | null; subscription: Record<string, unknown> | null }
const tierOf = (p: Provider): Tier => ((p.subscription?.plan as string) === "franchise" ? "franchise" : (p.type === "company" ? "company" : "freelancer"));

type FilterId = "all" | Tier | "customers" | "bugs" | "resolved";
const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" }, { id: "freelancer", label: "Freelancer" }, { id: "company", label: "Company" },
  { id: "franchise", label: "Franchise" }, { id: "customers", label: "Customers" }, { id: "bugs", label: "🐞 Bugs" }, { id: "resolved", label: "Resolved" },
];

export function SupportInboxApp() {
  const [threads, setThreads] = useState<Thread[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = loadThreads();
    if (!raw.length) { saveThreads(SEED); return SEED; }
    return raw;
  });
  const [filter, setFilter] = useState<FilterId>("all");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    apiGet<{ providers: Provider[] }>("/api/platform/providers")
      .then((d) => setProviders(d.providers ?? []))
      .catch(() => setProviders([]));
  }, []);

  const update = (next: Thread[]) => { setThreads(next); saveThreads(next); };
  const patch = (id: string, fn: (t: Thread) => Thread) => update(threads.map((t) => (t.id === id ? fn(t) : t)));

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return threads
      .filter((t) => {
        if (filter === "bugs") return t.kind === "bug";
        if (filter === "resolved") return t.status === "resolved";
        if (filter === "customers") return t.party === "customer";
        if (filter === "all") return true;
        return t.tier === filter;
      })
      .filter((t) => filter === "resolved" || t.status !== "resolved" || filter === "all")
      .filter((t) => !ql || t.name.toLowerCase().includes(ql) || t.email.toLowerCase().includes(ql) || t.providerName.toLowerCase().includes(ql) || t.subject.toLowerCase().includes(ql))
      .sort((a, b) => (a.status === b.status ? (a.updatedAt < b.updatedAt ? 1 : -1) : a.status === "open" ? -1 : 1));
  }, [threads, filter, q]);

  const sel = threads.find((t) => t.id === selId) ?? null;
  const openCount = threads.filter((t) => t.status === "open").length;
  const unreadCount = threads.filter((t) => t.unread).length;
  const bugCount = threads.filter((t) => t.kind === "bug" && t.status === "open").length;

  const openThread = (t: Thread) => { setSelId(t.id); if (t.unread) patch(t.id, (x) => ({ ...x, unread: false })); };
  const reply = (body: string) => sel && patch(sel.id, (t) => ({ ...t, messages: [...t.messages, { id: uid(), from: "hq", body, at: nowIso() }], updatedAt: nowIso(), status: "open" }));
  const toggleResolved = () => sel && patch(sel.id, (t) => ({ ...t, status: t.status === "open" ? "resolved" : "open", updatedAt: nowIso() }));
  const createThread = (t: Thread) => { update([t, ...threads]); setSelId(t.id); setComposing(false); };

  return (
    <div className="text-[var(--ink)]">
      <div className="overflow-hidden rounded-2xl text-white" style={{ background: HERO }}>
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-4">
          <div>
            <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Support &amp; messages</h2>
            <p className="mt-0.5 text-[12.5px] text-white/80">Talk to providers and their customers, and triage reported bugs — all in one HQ inbox.</p>
          </div>
          <div className="flex gap-2">
            <Stat label="Open" value={openCount} />
            <Stat label="Unread" value={unreadCount} />
            <Stat label="Open bugs" value={bugCount} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
              className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
              style={on ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
              {f.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, provider…"
            className="w-56 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
          <button type="button" onClick={() => setComposing(true)}
            className="rounded-full bg-[#1d3a8f] px-3.5 py-1.5 text-[12.5px] font-bold text-white hover:bg-[#16306e]">✉️ New message</button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,360px)_1fr]">
        {/* Thread list */}
        <div className="flex flex-col gap-2">
          {filtered.length === 0 && <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-8 text-center text-[12.5px] text-[var(--ink-3)]">No conversations here.</div>}
          {filtered.map((t) => {
            const isSel = t.id === selId;
            const last = t.messages[t.messages.length - 1];
            return (
              <button key={t.id} type="button" onClick={() => openThread(t)}
                className="rounded-2xl border bg-[var(--surface)] px-3.5 py-3 text-left transition-colors hover:bg-[var(--panel)]"
                style={{ borderColor: isSel ? "#1d3a8f" : "var(--line)", boxShadow: isSel ? "0 0 0 1px #1d3a8f inset" : "0 1px 2px rgba(16,24,40,.04)" }}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-extrabold text-white" style={{ background: grad(t.name) }}>{initials(t.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13.5px] font-extrabold">{t.name}</span>
                      {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#EE1F63]" />}
                    </div>
                    <div className="truncate text-[11px] text-[var(--ink-3)]">
                      {t.party === "customer" ? <>Customer · via {t.providerName}</> : <>Provider</>}
                    </div>
                  </div>
                  <TierChip tier={t.tier} />
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {t.kind === "bug" && <span className="shrink-0 text-[11px]">🐞</span>}
                  <span className="truncate text-[12.5px] font-semibold">{t.subject}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[11.5px] text-[var(--ink-3)]">{last?.from === "hq" ? "You: " : ""}{last?.body}</span>
                  {t.status === "resolved" && <span className="shrink-0 rounded-full bg-[#e7f6ee] px-1.5 py-0.5 text-[10px] font-bold text-[#0f7a43]">Resolved</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Conversation */}
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          {!sel ? (
            <div className="flex h-full min-h-[320px] items-center justify-center px-6 text-center text-[13px] text-[var(--ink-3)]">Pick a conversation to read and reply.</div>
          ) : (
            <Conversation key={sel.id} t={sel} onReply={reply} onToggleResolved={toggleResolved} />
          )}
        </div>
      </div>

      {composing && <Composer providers={providers} onClose={() => setComposing(false)} onCreate={createThread} />}
    </div>
  );
}

function Conversation({ t, onReply, onToggleResolved }: { t: Thread; onReply: (b: string) => void; onToggleResolved: () => void }) {
  const [draft, setDraft] = useState("");
  const send = () => { const b = draft.trim(); if (!b) return; onReply(b); setDraft(""); };
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-extrabold text-white" style={{ background: grad(t.name) }}>{initials(t.name)}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-extrabold">{t.name}</span>
              <TierChip tier={t.tier} />
            </div>
            <div className="text-[11.5px] text-[var(--ink-3)]">{t.email} · {t.party === "customer" ? `Customer of ${t.providerName}` : "Provider"}</div>
          </div>
        </div>
        <button type="button" onClick={onToggleResolved}
          className="rounded-full border px-3 py-1.5 text-[12px] font-bold"
          style={t.status === "open" ? { borderColor: "#0f7a43", color: "#0f7a43" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
          {t.status === "open" ? "✓ Mark resolved" : "↩︎ Reopen"}
        </button>
      </div>

      {t.report && (
        <div className="mx-4 mt-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[12px] font-extrabold">🐞 Reported details</span>
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: SEV[t.report.severity].bg, color: SEV[t.report.severity].fg }}>{SEV[t.report.severity].label}</span>
            <span className="text-[11px] text-[var(--ink-3)]">{t.report.channel}</span>
          </div>
          <dl className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-1 text-[12px]">
            <dt className="text-[var(--ink-3)]">Page</dt><dd className="font-semibold">{t.report.page}</dd>
            <dt className="text-[var(--ink-3)]">Device</dt><dd className="font-semibold">{t.report.device}</dd>
            <dt className="text-[var(--ink-3)]">Steps</dt><dd>{t.report.steps}</dd>
          </dl>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4">
        <div className="text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">{t.subject}</div>
        {t.messages.map((m) => (
          <div key={m.id} className={"max-w-[78%] " + (m.from === "hq" ? "self-end" : "self-start")}>
            <div className={"rounded-2xl px-3.5 py-2 text-[13px] " + (m.from === "hq" ? "bg-[#1d3a8f] text-white" : "bg-[var(--panel)] text-[var(--ink)]")}>{m.body}</div>
            <div className={"mt-0.5 text-[10.5px] text-[var(--ink-3)] " + (m.from === "hq" ? "text-right" : "")}>{m.from === "hq" ? "HQ" : t.name.split(" ")[0]} · {fmtWhen(m.at)}</div>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 border-t border-[var(--line)] px-3 py-3">
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
          placeholder="Write a reply…  (⌘/Ctrl + Enter to send)"
          className="flex-1 resize-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[#1d3a8f]" />
        <button type="button" onClick={send} disabled={!draft.trim()}
          className="rounded-xl bg-[#1d3a8f] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-40">Send</button>
      </div>
    </div>
  );
}

function Composer({ providers, onClose, onCreate }: { providers: Provider[]; onClose: () => void; onCreate: (t: Thread) => void }) {
  const [party, setParty] = useState<Party>("provider");
  const [tierFilter, setTierFilter] = useState<"all" | Tier>("all");
  const [providerId, setProviderId] = useState("");
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const list = useMemo(() => providers.filter((p) => tierFilter === "all" || tierOf(p) === tierFilter), [providers, tierFilter]);
  const chosen = providers.find((p) => p.id === providerId) ?? null;

  const canSend = !!subject.trim() && !!body.trim() && (party === "provider" ? !!chosen : (!!custName.trim() && !!custEmail.trim() && !!chosen));
  const submit = () => {
    if (!canSend || !chosen) return;
    const tier = tierOf(chosen);
    const t: Thread = party === "provider"
      ? seed("provider", chosen.name, chosen.contactEmail ?? chosen.ownerEmail ?? "", tier, chosen.name, subject.trim(), "message", undefined, "open", false, [["hq", body.trim(), nowIso()]])
      : seed("customer", custName.trim(), custEmail.trim(), tier, chosen.name, subject.trim(), "message", undefined, "open", false, [["hq", body.trim(), nowIso()]]);
    onCreate(t);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-[var(--surface)] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 text-white" style={{ background: HERO }}>
          <span className="text-[15px] font-extrabold">New message</span>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white">✕</button>
        </div>
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-5">
          <div className="inline-flex w-fit rounded-full border border-[var(--line)] p-0.5">
            {(["provider", "customer"] as Party[]).map((p) => (
              <button key={p} type="button" onClick={() => { setParty(p); setProviderId(""); }}
                className="rounded-full px-4 py-1.5 text-[12.5px] font-bold capitalize"
                style={party === p ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-2)" }}>{p === "provider" ? "To a provider" : "To a customer"}</button>
            ))}
          </div>

          {party === "provider" && (
            <div className="flex flex-wrap gap-1.5">
              {([["all", "All"], ["freelancer", "Freelancer"], ["company", "Company"], ["franchise", "Franchise"]] as [("all" | Tier), string][]).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setTierFilter(id)}
                  className="rounded-full border px-3 py-1 text-[11.5px] font-bold"
                  style={tierFilter === id ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>
              ))}
            </div>
          )}

          {party === "customer" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Customer name"><input value={custName} onChange={(e) => setCustName(e.target.value)} className={inputCls} /></Field>
              <Field label="Customer email"><input value={custEmail} onChange={(e) => setCustEmail(e.target.value)} className={inputCls} /></Field>
            </div>
          )}

          <Field label={party === "provider" ? "Provider" : "Their provider"}>
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className={inputCls}>
              <option value="">{providers.length ? "Select…" : "Loading providers…"}</option>
              {list.map((p) => <option key={p.id} value={p.id}>{p.name} · {TIERS[tierOf(p)].label}</option>)}
            </select>
          </Field>

          <Field label="Subject"><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} placeholder="What's this about?" /></Field>
          <Field label="Message"><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={inputCls} /></Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--line)] px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-4 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)]">Cancel</button>
          <button type="button" onClick={submit} disabled={!canSend} className="rounded-full bg-[#1d3a8f] px-4 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-40">Send message</button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[#1d3a8f]";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11.5px] font-bold text-[var(--ink-3)]">{label}</span>{children}</label>;
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/12 px-3.5 py-2 text-center">
      <div className="text-[20px] font-extrabold leading-none">{value}</div>
      <div className="mt-1 text-[10.5px] uppercase tracking-wide text-white/70">{label}</div>
    </div>
  );
}
function TierChip({ tier }: { tier: Tier }) {
  const s = TIERS[tier];
  return <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}
