"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { get as apiGet, post as apiPost, put as apiPut, setActAs } from "@/lib/api";
import { getDefaultView, type PortalKey } from "@/lib/nav/config";
import { useRealtime } from "@/lib/realtime";
import { CategoryManager } from "./SupportInboxApp";

// ── Support review ───────────────────────────────────────────────────────────
// The tracking side of HQ support: every thread (messages AND bugs) recollected
// and grouped by CATEGORY → PROVIDER, each category carrying an AI summary of the
// recurring concern. This is where trends are read; the raw back-and-forth stays
// on Messages & support. Backed by GET /api/platform/support/review.

interface Category { id: string; label: string; emoji?: string }
type Tier = "freelancer" | "company" | "franchise";
type ThreadStatus = "open" | "in_progress" | "resolved";
interface NoteRow { id: string; at: string; byEmail: string | null; text: string }
interface ThreadRow { id: string; ticket: string | null; subject: string; status: ThreadStatus; snippet: string; at: string; providerName: string; tier: Tier; franchiseId: string | null; email: string; providerId: string | null; party: string; notes: NoteRow[] }
interface CategoryGroup { categoryId: string; label: string; emoji?: string; count: number; open: number; threads: ThreadRow[]; aiSummary: string | null }
interface Review {
  aiConfigured: boolean;
  totals: { threads: number; open: number; inProgress: number; resolved: number; bugs: number };
  overview: string | null;
  categoryGroups: CategoryGroup[];
  dupeClusters: { id: string; dupes: number }[];
}

const HERO = "radial-gradient(120% 160% at 12% -30%, rgba(120,170,255,.5) 0%, transparent 55%), var(--hero-grad)";
const STATUS_META = {
  open: { label: "Open", bg: "#E8EEFD", fg: "#2f5fd0" },
  in_progress: { label: "In progress", bg: "#FCF1DC", fg: "#F5A524" },
  resolved: { label: "Resolved", bg: "#E2F6EC", fg: "#0f7a43" },
} as const;
const TIER_CHIP: Record<Tier, { label: string; bg: string; fg: string }> = {
  freelancer: { label: "Freelancer", bg: "#E8EEFD", fg: "#2f5fd0" },
  company: { label: "Company", bg: "#E8EEFD", fg: "#2f5fd0" },
  franchise: { label: "Franchise", bg: "#E8EEFD", fg: "#2f5fd0" },
};
const chipFor = (p: { tier: Tier; franchiseId: string | null }) => (p.tier === "franchise" && !p.franchiseId ? { label: "Head office", bg: "#E2F6EC", fg: "#0f7a43" } : TIER_CHIP[p.tier]);
const initials = (s: string) => (s.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?");
const GRADS = ["linear-gradient(135deg,#2f5fd0,#2f5fd0)", "linear-gradient(135deg,#2f5fd0,#5aa0f0)", "linear-gradient(135deg,#274ba3,#2f5fd0)", "linear-gradient(135deg,#6d28d9,#5a3fd0)"];
const grad = (s: string) => GRADS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADS.length];
const fmtWhen = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");
const selCls = "rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)] outline-none focus:border-[#C6D0E6]";

interface Account { uid: string; email: string; role: string; portal: string; label: string }

export function SupportReviewApp() {
  const router = useRouter();
  const [data, setData] = useState<Review | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [statusF, setStatusF] = useState<"all" | "open" | "resolved">("all");
  const [catF, setCatF] = useState<string>("all");     // "all" | categoryId
  const [provF, setProvF] = useState<string>("all");   // "all" | provider name

  const load = useCallback(() => {
    apiGet<Review>("/api/platform/support/review").then((d) => { setData(d); setErr(null); })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  const loadCats = useCallback(() => {
    apiGet<{ categories: Category[] }>("/api/platform/support/categories").then((d) => setCategories(d.categories ?? [])).catch(() => {});
  }, []);
  useEffect(() => { load(); loadCats(); }, [load, loadCats]);
  useEffect(() => { apiGet<{ accounts: Account[] }>("/api/platform/accounts").then((d) => setAccounts(d.accounts ?? [])).catch(() => {}); }, []);
  useRealtime(["supportThreads"], load);

  // Drop straight into the reporter's own account (impersonation) — matched by
  // the thread's email against the impersonatable accounts list.
  const openAccount = async (email: string) => {
    const acc = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
    if (!acc) { setErr(`No account found to open for ${email || "this thread"}.`); return; }
    try {
      const r = await apiPost<{ uid: string; role: string; portal: string }>("/api/platform/impersonate", { uid: acc.uid });
      setActAs({ uid: acc.uid, label: acc.label, portal: r.portal, role: r.role });
      router.push(`/${r.portal}/${getDefaultView(r.portal as PortalKey)}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't open that account"); }
  };

  const run = (p: Promise<unknown>) => p.then(() => { setErr(null); load(); }).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  // A short, friendly note the provider sees when you choose to inform them.
  const STATUS_MSG: Record<ThreadStatus, string> = {
    resolved: "Update from the ActivityOS team: we've marked this as resolved. Do reply if anything's still not right.",
    in_progress: "Update from the ActivityOS team: we're on this now and will keep you posted.",
    open: "Update from the ActivityOS team: we've reopened this and are taking another look.",
  };
  const setStatus = (id: string, status: ThreadStatus, inform: boolean) =>
    run(apiPut(`/api/platform/support/${id}`, { status }).then(() => (inform ? apiPost(`/api/platform/support/${id}/messages`, { body: STATUS_MSG[status] }) : null)));
  const addNote = (id: string, text: string) => run(apiPost(`/api/platform/support/${id}/note`, { text }));
  const informProvider = (id: string, body: string) => run(apiPost(`/api/platform/support/${id}/messages`, { body }));

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Dropdown option lists, drawn from whatever's actually in the data.
  const provOptions = useMemo(() => {
    const names = new Set<string>();
    for (const g of data?.categoryGroups ?? []) for (const t of g.threads) names.add(t.providerName);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [data]);

  // All three filters (status · category · provider) applied client-side over the
  // flat thread rows: rows that don't match drop out, empty categories disappear
  // and counts recompute. The AI summary is a general read, kept as-is.
  const groups = useMemo<CategoryGroup[]>(() => {
    if (!data) return [];
    return data.categoryGroups
      .filter((g) => catF === "all" || g.categoryId === catF)
      .map((g) => {
        const threads = g.threads
          .filter((r) => provF === "all" || r.providerName === provF)
          .filter((r) => statusF === "all" || (statusF === "resolved" ? r.status === "resolved" : r.status !== "resolved"));
        return { ...g, threads, count: threads.length, open: threads.filter((r) => r.status !== "resolved").length };
      })
      .filter((g) => g.count > 0);
  }, [data, statusF, catF, provF]);

  // Auto-expand every category when a category/provider filter narrows the view,
  // so the matching threads are visible without an extra click.
  useEffect(() => {
    if (catF !== "all" || provF !== "all") setOpen(new Set(groups.map((g) => g.categoryId)));
  }, [catF, provF, groups]);

  return (
    <div className="text-[var(--ink)]">
      <div className="overflow-hidden rounded-2xl text-white" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1.6px), ${HERO}`, backgroundSize: "18px 18px, cover, cover, cover, cover", backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat" }}>
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-4">
          <div>
            <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: "#fff" }}>Support review</h2>
            <p className="mt-0.5 text-[12.5px] text-white/80">Every message &amp; bug, grouped by category with an AI read of the recurring concern — so trends are easy to track.</p>
          </div>
          {data && (
            <div className="flex gap-2">
              <Stat label="Threads" value={data.totals.threads} />
              <Stat label="Open" value={data.totals.open + data.totals.inProgress} />
              <Stat label="Bugs" value={data.totals.bugs} />
            </div>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setManaging(true)}
          className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)] hover:border-[#C6D0E6]">⚙︎ Manage categories</button>
        <button type="button" onClick={load}
          className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)] hover:border-[#C6D0E6]">↻ Refresh</button>
        {(statusF !== "all" || catF !== "all" || provF !== "all") && (
          <button type="button" onClick={() => { setStatusF("all"); setCatF("all"); setProvF("all"); }}
            className="rounded-full bg-[#FDE7EF] px-3.5 py-1.5 text-[12px] font-bold text-[#C81E5E] hover:bg-[#FDE7EF]">✕ Clear filters</button>
        )}
        <a href="/platform/messages" className="ml-auto rounded-full bg-[#2f5fd0] px-3.5 py-1.5 text-[12.5px] font-bold text-white hover:bg-[#2f5fd0]">← Back to inbox</a>
      </div>

      {/* Circular filter panel */}
      {data && (
        <div className="mt-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Status</div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Circle size="lg" label="Everything" count={data.totals.threads} tone="ink" on={statusF === "all"} onClick={() => setStatusF("all")} />
            <Circle size="lg" label="Open" count={data.totals.open + data.totals.inProgress} tone="blue" on={statusF === "open"} onClick={() => setStatusF("open")} />
            <Circle size="lg" label="Resolved" count={data.totals.resolved} tone="green" on={statusF === "resolved"} onClick={() => setStatusF("resolved")} />
            <span className="mx-1 hidden h-16 w-px bg-[var(--line)] sm:block" />
            <label className="flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--ink-3)]">
              Provider
              <select value={provF} onChange={(e) => setProvF(e.target.value)} className={selCls} aria-label="Provider">
                <option value="all">Everyone</option>
                {provOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>

          <div className="mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Category</div>
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            <Circle emoji="🗂" label="All" count={data.totals.threads} tone="ink" on={catF === "all"} onClick={() => setCatF("all")} />
            {data.categoryGroups.map((g) => (
              <Circle key={g.categoryId} emoji={g.emoji ?? "🗂"} label={g.label} count={g.count} tone="violet" on={catF === g.categoryId} onClick={() => setCatF(g.categoryId)} />
            ))}
          </div>
        </div>
      )}

      {err && <div className="mt-3 rounded-xl border px-3.5 py-2 text-[12.5px] font-bold" style={{ borderColor: "#C81E5E", background: "#FDE7EF", color: "#C81E5E" }}>{err}</div>}

      {!data ? (
        <div className="mt-8 text-center text-[12.5px] text-[var(--ink-3)]">Gathering the picture…</div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* AI overview */}
          {data.overview ? (
            <div className="rounded-2xl border border-[#E4E9F5] bg-[#E8EEFD] px-4 py-3">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#2f5fd0]">✦ AI overview</div>
              <p className="text-[13px] leading-relaxed text-[var(--ink)]">{data.overview}</p>
            </div>
          ) : !data.aiConfigured ? (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[12px] text-[var(--ink-3)]">
              ✦ AI summaries are switched on once the model key is configured on the server — the grouped tracking below works regardless.
            </div>
          ) : null}

          {groups.length === 0 ? (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-10 text-center text-[13px] text-[var(--ink-3)]">{statusF === "all" ? "Nothing to review yet — messages and bug reports will collect here." : `No ${statusF} threads.`}</div>
          ) : (
            groups.map((g) => {
              const isOpen = open.has(g.categoryId);
              return (
                <div key={g.categoryId} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                  <button type="button" onClick={() => toggle(g.categoryId)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--panel)]">
                    <span className="text-[18px]">{g.emoji ?? "🗂"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-extrabold">{g.label}</span>
                        <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-2)]">{g.count} {g.count === 1 ? "thread" : "threads"}</span>
                        {g.open > 0 && <span className="rounded-full bg-[#E8EEFD] px-2 py-0.5 text-[11px] font-bold text-[#2f5fd0]">{g.open} open</span>}
                      </div>
                      {g.aiSummary && <p className="mt-0.5 truncate text-[12px] italic text-[var(--ink-2)]">✦ {g.aiSummary}</p>}
                    </div>
                    <span className="shrink-0 text-[13px] text-[var(--ink-3)]">{isOpen ? "▾" : "▸"}</span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-[var(--line)] px-4 py-3">
                      {g.aiSummary && (
                        <div className="mb-3 rounded-xl bg-[#E8EEFD] px-3 py-2 text-[12.5px] leading-relaxed text-[var(--ink)]">
                          <span className="font-bold text-[#2f5fd0]">✦ Summary · </span>{g.aiSummary}
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {g.threads.map((r) => (
                          <ManagedThread key={r.id} r={r}
                            onStatus={(s, inform) => setStatus(r.id, s, inform)}
                            onNote={(text) => addNote(r.id, text)}
                            onInform={(body) => informProvider(r.id, body)}
                            onOpenAccount={() => openAccount(r.email)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {managing && <CategoryManager categories={categories} onClose={() => setManaging(false)} onSaved={(c) => { setCategories(c); load(); }} />}
    </div>
  );
}

// One thread on the review page you can act on without leaving: change status,
// jot an internal note, and choose whether the provider is told (Show) or the
// change stays HQ-only (Hide).
function ManagedThread({ r, onStatus, onNote, onInform, onOpenAccount }: {
  r: ThreadRow;
  onStatus: (s: ThreadStatus, inform: boolean) => void;
  onNote: (text: string) => void;
  onInform: (body: string) => void;
  onOpenAccount: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [inform, setInform] = useState(false);   // false = Hide (internal) · true = Show (tell provider)
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const st = STATUS_META[r.status === "resolved" ? "resolved" : "open"];   // legacy "in_progress" shows as Open
  const chip = chipFor(r);
  const saveNote = () => { const x = note.trim(); if (!x) return; onNote(x); setNote(""); };
  const sendMsg = () => { const x = msg.trim(); if (!x) return; onInform(x); setMsg(""); };
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center gap-2 px-2.5 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[9.5px] font-extrabold text-white" style={{ background: grad(r.providerName) }}>{initials(r.providerName)}</span>
        <span className="shrink-0 truncate text-[12.5px] font-extrabold">{r.providerName}</span>
        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: chip.bg, color: chip.fg }}>{chip.label}</span>
        <span className="mx-0.5 h-3 w-px shrink-0 bg-[var(--line)]" />
        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
        {r.ticket && <span className="shrink-0 rounded bg-[var(--panel)] px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-[var(--ink-3)]">{r.ticket}</span>}
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{r.subject}</span>
        {(r.notes?.length ?? 0) > 0 && <span className="shrink-0 text-[10.5px] text-[var(--ink-3)]" title="Internal notes">📝 {r.notes.length}</span>}
        <span className="shrink-0 text-[10.5px] text-[var(--ink-3)]">{fmtWhen(r.at)}</span>
        <button type="button" onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-full border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:border-[#C6D0E6]">{expanded ? "Close" : "Manage"}</button>
        <button type="button" onClick={onOpenAccount} title="Open this account and see what they see"
          className="shrink-0 rounded-full border border-[#E4E9F5] px-2 py-0.5 text-[10.5px] font-bold text-[#2f5fd0] hover:bg-[#EDE9FD]">🔎 Open account</button>
        <a href={`/platform/messages?thread=${r.id}`} title="Open the full conversation"
          className="shrink-0 text-[11px] font-bold text-[#2f5fd0] hover:underline">Thread ↗</a>
      </div>

      {expanded && (
        <div className="space-y-2.5 border-t border-[var(--line)] px-3 py-2.5">
          {/* Inform toggle — controls whether status changes & messages reach the provider. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Provider updates</span>
            <div className="inline-flex rounded-full border border-[var(--line)] p-0.5">
              <button type="button" onClick={() => setInform(false)}
                className="rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors" style={!inform ? { background: "#6b6880", color: "#fff" } : { color: "var(--ink-3)" }}>🙈 Hide (internal)</button>
              <button type="button" onClick={() => setInform(true)}
                className="rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors" style={inform ? { background: "#0f7a43", color: "#fff" } : { color: "var(--ink-3)" }}>👁 Show (tell them)</button>
            </div>
            <span className="text-[10.5px] text-[var(--ink-3)]">{inform ? "Status changes send the provider a note." : "Changes stay HQ-only."}</span>
          </div>

          {/* Status */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Status</span>
            {(["open", "resolved"] as ThreadStatus[]).map((s) => {
              const on = (s === "open" ? r.status !== "resolved" : r.status === "resolved"); const m = STATUS_META[s];
              return (
                <button key={s} type="button" onClick={() => { if (!on) onStatus(s, inform); }}
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors"
                  style={on ? { background: m.fg, color: "#fff" } : { border: "1px solid var(--line)", color: "var(--ink-2)" }}>{m.label}</button>
              );
            })}
          </div>

          {/* Existing internal notes */}
          {(r.notes?.length ?? 0) > 0 && (
            <div className="space-y-1">
              {r.notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-[var(--panel)] px-2.5 py-1.5">
                  <div className="text-[12px] text-[var(--ink)]">{n.text}</div>
                  <div className="mt-0.5 text-[10px] text-[var(--ink-3)]">{n.byEmail ?? "HQ"} · {fmtWhen(n.at)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Add internal note (never shown to the provider) */}
          <div className="flex items-end gap-2">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={1}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveNote(); } }}
              placeholder="📝 Internal note (only your team sees this)…"
              className="flex-1 resize-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] outline-none focus:border-[#C6D0E6]" />
            <button type="button" onClick={saveNote} disabled={!note.trim()}
              className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[11.5px] font-bold text-[var(--ink-2)] disabled:opacity-40">Add note</button>
          </div>

          {/* Message the provider — only when Show is on */}
          {inform && (
            <div className="flex items-end gap-2">
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={1}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendMsg(); } }}
                placeholder="👁 Message the provider (they'll see this)…"
                className="flex-1 resize-none rounded-lg border border-[#E4E9F5] bg-[#E2F6EC] px-2.5 py-1.5 text-[12px] outline-none focus:border-[#0f7a43]" />
              <button type="button" onClick={sendMsg} disabled={!msg.trim()}
                className="rounded-lg bg-[#0f7a43] px-2.5 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-40">Send</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// A big, tappable circular filter — count inside a coloured ring (or an emoji,
// with the count tucked under the label). Selected states pop with a lift + glow.
const CIRCLE_TONES = {
  ink: { ring: "#6b6880", bg: "#E8EEFD" },
  blue: { ring: "#2f5fd0", bg: "#E8EEFD" },
  green: { ring: "#0f7a43", bg: "#E2F6EC" },
  violet: { ring: "#6d28d9", bg: "#EDE9FD" },
} as const;
function Circle({ label, count, emoji, on, tone, size = "sm", onClick }: {
  label: string; count: number; emoji?: string; on: boolean; tone: keyof typeof CIRCLE_TONES; size?: "sm" | "lg"; onClick: () => void;
}) {
  const T = CIRCLE_TONES[tone];
  const d = size === "lg" ? 84 : 66;
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5" style={{ width: d + 14 }}>
      <span className="flex items-center justify-center rounded-full transition-all duration-150" style={{
        width: d, height: d,
        background: on ? T.bg : "var(--surface)",
        border: `3px solid ${on ? T.ring : "var(--line)"}`,
        boxShadow: on ? `0 12px 26px -8px ${T.ring}88` : "0 1px 2px rgba(16,24,40,.05)",
        transform: on ? "translateY(-3px) scale(1.05)" : "none",
      }}>
        {emoji
          ? <span style={{ fontSize: size === "lg" ? 32 : 26 }}>{emoji}</span>
          : <span className="font-extrabold tabular-nums leading-none" style={{ fontSize: size === "lg" ? 28 : 22, color: on ? T.ring : "var(--ink)" }}>{count}</span>}
      </span>
      <span className="text-center text-[11.5px] font-bold leading-tight" style={{ color: on ? T.ring : "var(--ink-2)" }}>
        {label}{emoji ? <span className="mt-0.5 block text-[10px] font-bold tabular-nums text-[var(--ink-3)]">{count}</span> : null}
      </span>
    </button>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/12 px-3.5 py-2 text-center">
      <div className="text-[20px] font-extrabold leading-none">{value}</div>
      <div className="mt-1 text-[10.5px] uppercase tracking-wide text-white/70">{label}</div>
    </div>
  );
}
