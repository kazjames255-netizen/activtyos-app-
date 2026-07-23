"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { MERGE_FIELDS, mergeFieldsFor } from "@/lib/merge-fields";
import { HowItWorks } from "@/components/HowItWorks";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card, Input, Select } from "@/components/ui";

// Messages runs on the same light surface as the customer dashboard, whichever
// portal it's in — so the operator inbox reads like the parent one instead of
// the default dark operator shell. (Mirror of the layout's custdash palette.)
const LIGHT_PALETTE = {
  "--bg": "#f5f8fd",
  "--surface": "#ffffff",
  "--panel": "#fbf8fc",
  "--ink": "#171534",
  "--ink-2": "#4a4763",
  "--ink-3": "#8a86a3",
  "--line": "#ece6f1",
} as CSSProperties;

interface Thread {
  id: string;
  tenantId: string;
  tenantName?: string;
  parentEmail: string;
  parentName?: string;
  subject?: string;
  folderId?: string;
  lastBody?: string;
  lastFrom?: "operator" | "parent";
  lastAt?: string;
  operatorUnread?: number;
  parentUnread?: number;
}
interface Folder { id: string; name: string }
interface BroadcastRec { id: string; body: string; subject?: string; sentAt?: string; recipientCount?: number; recipients?: { email: string; name: string }[] }
interface Template { id: string; name: string; subject?: string; body: string }
// Client merge for a 1:1 send — fills what we know about the chosen family.
// (Broadcast fills {ParentName}/{ProviderName} server-side; per-booking fields
// like {ListingName}/{SessionDate} need booking context — see handoff §II.)
const mergeText = (text: string, v: { parentName?: string; providerName?: string; childName?: string }) =>
  text
    .replace(/\{ParentName\}/gi, v.parentName ?? "")
    .replace(/\{ProviderName\}/gi, v.providerName ?? "")
    .replace(/\{ChildName\}/gi, v.childName ?? "");
interface Message { id: string; from: "operator" | "parent"; senderName?: string; body: string; createdAt?: string }
interface Provider { tenantId: string; name: string }
interface Customer { id: string; name?: string; email?: string; locationName?: string; children?: { name?: string }[] }

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
// Tidy one-line subtitle for a family: who they parent, where, and their email.
const familySub = (c: Customer) => {
  const kids = (c.children ?? []).map((k) => k.name).filter(Boolean);
  return [kids.length ? `Parent of ${kids.join(", ")}` : null, c.locationName ? `📍 ${c.locationName}` : null, c.email || null]
    .filter(Boolean)
    .join("  ·  ");
};
const shortWhen = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

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
  const [subject, setSubject] = useState(""); // optional heading for a NEW thread
  const [familyQuery, setFamilyQuery] = useState("");
  const [familyTargets, setFamilyTargets] = useState<string[]>([]); // operator: 1+ family emails
  const [pickerOpen, setPickerOpen] = useState(true); // recipient picker expanded?
  const [composeMode, setComposeMode] = useState<"family" | "group">("family");
  const [listings, setListings] = useState<string[]>([]);
  const [listingTargets, setListingTargets] = useState<string[]>([]);
  const [listingQuery, setListingQuery] = useState("");
  const [listingRecipients, setListingRecipients] = useState<{ email: string; name: string; child?: string }[]>([]);
  const [excludedEmails, setExcludedEmails] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "reply">("all");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("all"); // "all" | "unfiled" | folderId
  const [broadcasts, setBroadcasts] = useState<BroadcastRec[]>([]);
  const [openBroadcast, setOpenBroadcast] = useState<BroadcastRec | null>(null);
  const [pro, setPro] = useState(false); // Simple ⇄ Pro composer
  const [templates, setTemplates] = useState<Template[]>([]);
  const [providerName, setProviderName] = useState("");
  const loadTemplates = () => apiGet<Template[]>("/api/messages/templates").then(setTemplates).catch(() => {});
  const endRef = useRef<HTMLDivElement>(null);
  const mine = mode === "operator" ? "operator" : "parent";
  const portalSeg = usePathname().split("/")[1] || "freelancer";

  const loadThreads = useCallback(() => {
    apiGet<Thread[]>("/api/messages/threads").then((t) => { setThreads(t); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  const loadThread = useCallback((id: string) => {
    apiGet<{ thread: Thread; messages: Message[] }>(`/api/messages/threads/${encodeURIComponent(id)}`).then((r) => { setMessages(r.messages); loadThreads(); }).catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [loadThreads]);

  // Folders are an operator-only way to file conversations (Resolved, etc.).
  const loadFolders = useCallback(() => {
    if (mode !== "operator") return;
    apiGet<Folder[]>("/api/messages/folders").then(setFolders).catch(() => {});
  }, [mode]);
  // The operator's bulk sends — shown as one "📣 Sent" row each, not N threads.
  const loadBroadcasts = useCallback(() => {
    if (mode !== "operator") return;
    apiGet<BroadcastRec[]>("/api/messages/broadcasts").then(setBroadcasts).catch(() => {});
  }, [mode]);

  useEffect(() => { loadThreads(); }, [loadThreads]);
  useEffect(() => { loadFolders(); }, [loadFolders]);
  useEffect(() => { loadBroadcasts(); }, [loadBroadcasts]);
  useEffect(() => {
    if (mode === "parent") apiGet<Provider[]>("/api/my/providers").then(setProviders).catch(() => {});
    // Only families with a valid email — you can't message the others, and a bad
    // address would otherwise break a broadcast.
    else apiGet<Customer[]>("/api/customers").then((c) => setCustomers(c.filter((x) => x.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email)))).catch(() => {});
  }, [mode]);
  // Operator listing names, for the "message a whole listing" broadcast.
  useEffect(() => {
    if (mode !== "operator") return;
    apiGet<{ tenantId?: string; tenantName?: string }>("/api/me")
      .then((me) => {
        if (me.tenantName) setProviderName(me.tenantName);
        if (!me.tenantId) return;
        return apiGet<{ name?: string }[]>(`/api/listings?tenantId=${encodeURIComponent(me.tenantId)}`)
          .then((ls) => setListings([...new Set(ls.map((l) => l.name).filter((n): n is string => !!n))].sort()));
      })
      .catch(() => {});
    loadTemplates();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  // Who's booked on the chosen listings — so the operator can review + un-tick.
  useEffect(() => {
    if (mode !== "operator" || listingTargets.length === 0) { setListingRecipients([]); return; }
    apiPost<{ email: string; name: string; child?: string }[]>("/api/messages/listing-recipients", { listings: listingTargets })
      .then((rs) => { setListingRecipients(rs); setExcludedEmails((ex) => ex.filter((e) => rs.some((r) => r.email === e))); })
      .catch(() => {});
  }, [mode, listingTargets]);
  useRealtime(["threads", "messages"], () => { loadThreads(); if (openId) loadThread(openId); });
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages]);

  function open(id: string) { setComposing(false); setSubject(""); setOpenBroadcast(null); setOpenId(id); loadThread(id); }
  // Open the composer pre-addressed to a family/provider found via search.
  function startWith(value: string) {
    setComposing(true); setOpenId(null); setMessages([]); setSubject(""); setComposeMode("family");
    if (mode === "operator") setFamilyTargets([value]); else setTarget(value);
  }

  async function createFolder() {
    const name = window.prompt("New folder name (e.g. Resolved)")?.trim();
    if (!name) return;
    try { await apiPost("/api/messages/folders", { name }); loadFolders(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t create folder"); }
  }
  async function renameFolder(f: Folder) {
    const name = window.prompt("Rename folder", f.name)?.trim();
    if (!name || name === f.name) return;
    try { await api(`/api/messages/folders/${encodeURIComponent(f.id)}`, { method: "PUT", body: JSON.stringify({ name }) }); loadFolders(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t rename folder"); }
  }
  async function deleteFolder(f: Folder) {
    if (!window.confirm(`Delete “${f.name}”? Its conversations move back to the Inbox.`)) return;
    try {
      await api(`/api/messages/folders/${encodeURIComponent(f.id)}`, { method: "DELETE" });
      if (activeFolder === f.id) setActiveFolder("all");
      loadFolders(); loadThreads();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete folder"); }
  }
  async function saveTemplate() {
    if (!draft.trim()) { setError("Write a message first, then save it as a template."); return; }
    const name = window.prompt("Template name (e.g. Welcome)")?.trim();
    if (!name) return;
    try { await apiPost("/api/messages/templates", { name, subject: subject.trim() || undefined, body: draft.trim() }); loadTemplates(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save template"); }
  }
  async function moveThread(threadId: string, folderId: string | null) {
    try { await api(`/api/messages/threads/${encodeURIComponent(threadId)}/folder`, { method: "PUT", body: JSON.stringify({ folderId }) }); loadThreads(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t move conversation"); }
  }

  async function send() {
    if (!draft.trim()) return;
    try {
      if (composing && composeMode === "group") {
        if (listingTargets.length === 0) { setError("Choose at least one listing to message."); return; }
        const res = await apiPost<{ sent: number }>("/api/messages/broadcast", { listings: listingTargets, excludeEmails: excludedEmails, body: draft, ...(subject.trim() ? { subject: subject.trim() } : {}) });
        const nL = listingTargets.length;
        setDraft(""); setSubject(""); setComposing(false); setListingTargets([]); setExcludedEmails([]); setComposeMode("family");
        setError(null); setNotice(`Sent to ${res.sent} ${res.sent === 1 ? "family" : "families"} across ${nL} ${nL === 1 ? "listing" : "listings"}.`);
        loadThreads(); loadBroadcasts();
        return;
      }
      if (composing && mode === "operator") {
        // "Families" mode — one or many families at once.
        if (familyTargets.length === 0) { setError("Choose at least one family."); return; }
        if (familyTargets.length > 1) {
          const res = await apiPost<{ sent: number }>("/api/messages/broadcast", { emails: familyTargets, body: draft, ...(subject.trim() ? { subject: subject.trim() } : {}) });
          setDraft(""); setSubject(""); setComposing(false); setFamilyTargets([]);
          setError(null); setNotice(`Sent to ${res.sent} ${res.sent === 1 ? "family" : "families"}.`);
          loadThreads(); loadBroadcasts();
          return;
        }
        const email = familyTargets[0];
        const c1 = customers.find((c) => c.email === email);
        const childName = c1?.children?.map((k) => k.name).filter(Boolean).join(" & ");
        const payload = { parentEmail: email, parentName: c1?.name, body: mergeText(draft, { parentName: c1?.name, providerName, childName }), ...(subject.trim() ? { subject: subject.trim() } : {}) };
        const res = await apiPost<{ threadId: string }>("/api/messages", payload);
        setDraft(""); setSubject(""); setComposing(false); setFamilyTargets([]); loadThreads(); open(res.threadId);
        return;
      }
      if (composing) {
        // Parent side — message one provider (auto-picked when there's only one).
        const tid = target || (providers.length === 1 ? providers[0]?.tenantId ?? "" : "");
        if (!tid) { setError("Choose who to message."); return; }
        const payload = { tenantId: tid, body: draft, ...(subject.trim() ? { subject: subject.trim() } : {}) };
        const res = await apiPost<{ threadId: string }>("/api/messages", payload);
        setDraft(""); setComposing(false); setTarget(""); setSubject(""); loadThreads(); open(res.threadId);
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
  // Child names per family email — so an operator sees "Amir (parent of Sally)"
  // and can tell families apart by the child, not just a common first name.
  const kidsByEmail = new Map<string, string[]>();
  for (const c of customers)
    if (c.email) kidsByEmail.set(c.email.toLowerCase(), (c.children ?? []).map((k) => k.name).filter((n): n is string => !!n));
  const withParent = (name: string, email?: string) => {
    if (mode !== "operator") return name;
    const kids = email ? kidsByEmail.get(email.toLowerCase()) ?? [] : [];
    return kids.length ? `${name} (parent of ${kids.join(", ")})` : name;
  };
  const other = (t: Thread) =>
    mode === "operator" ? withParent(t.parentName || t.parentEmail, t.parentEmail) : t.tenantName || "Provider";
  const unread = (t: Thread) => (mode === "operator" ? t.operatorUnread : t.parentUnread) ?? 0;
  // "Needs reply" = the last word was theirs, not yours — the ball's in your court.
  const needsReply = (t: Thread) => !!t.lastFrom && t.lastFrom !== mine;

  const allThreads = threads ?? [];
  const counts = {
    all: allThreads.length,
    unread: allThreads.filter((t) => unread(t) > 0).length,
    reply: allThreads.filter(needsReply).length,
  };
  const inFolder = (t: Thread) => (activeFolder === "all" ? true : t.folderId === activeFolder);
  const folderCount = (id: string) => allThreads.filter((t) => t.folderId === id).length;
  const shownThreads = allThreads.filter((t) => {
    if (!inFolder(t)) return false;
    if (statusFilter === "unread" && unread(t) === 0) return false;
    if (statusFilter === "reply" && !needsReply(t)) return false;
    if (q.trim()) {
      // Match the person, the subject, AND the latest message text so you can
      // find a thread by something that was said in it, not just who it's with.
      const hay = `${other(t)} ${mode === "operator" ? t.parentEmail : t.tenantName ?? ""} ${t.subject ?? ""} ${t.lastBody ?? ""}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });
  const filterTabs: { key: "all" | "unread" | "reply"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "reply", label: mode === "operator" ? "Needs reply" : "Awaiting you" },
    { key: "unread", label: "New" },
  ];

  // Search should also surface people you *haven't* messaged yet (the box says
  // "Search families…", not "search conversations") so a name with no thread can
  // still be found and started. Excludes anyone already in a thread above.
  const qv = q.trim().toLowerCase();
  const threadedKeys = new Set(
    allThreads.map((t) => (mode === "operator" ? t.parentEmail ?? "" : t.tenantId ?? "").toLowerCase()),
  );
  const startable = !qv
    ? []
    : mode === "operator"
      ? customers
          .filter((c) => c.email && !threadedKeys.has(c.email.toLowerCase()) && `${c.name ?? ""} ${c.email}`.toLowerCase().includes(qv))
          .map((c) => ({ key: c.id, value: c.email as string, label: withParent(c.name || (c.email as string), c.email), sub: c.email as string }))
      : providers
          .filter((p) => !threadedKeys.has((p.tenantId ?? "").toLowerCase()) && p.name.toLowerCase().includes(qv))
          .map((p) => ({ key: p.tenantId, value: p.tenantId, label: p.name, sub: "" }));

  // The Pro composer bar — Simple/Pro toggle, templates and merge fields — shown
  // above the message box wherever the operator writes (new message or reply).
  // Which merge fields can resolve in the current compose context, and whether a
  // template is safe to use here (a template that needs a booking field won't
  // work in family/broadcast messaging, so it's disabled in the picker).
  const composeCtx = composeMode === "group" ? "listing" : "family";
  const allowedTokens = new Set(mergeFieldsFor(composeCtx).map((f) => f.token.toLowerCase()));
  const knownTokens = new Set(MERGE_FIELDS.map((f) => f.token.toLowerCase()));
  const templateUsable = (t: Template) => {
    const used = (`${t.subject ?? ""} ${t.body}`.match(/\{[A-Za-z]+\}/g) ?? []).map((x) => x.toLowerCase());
    return used.every((tok) => !knownTokens.has(tok) || allowedTokens.has(tok));
  };
  const proBar = mode !== "operator" ? null : (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] px-2.5 pt-2">
      <div className="mr-1 flex gap-0.5 rounded-full border border-[var(--line)] p-0.5">
        {([["simple", "Simple"], ["pro", "Pro ✦"]] as const).map(([m, label]) => {
          const on = (m === "pro") === pro;
          return <button key={m} type="button" onClick={() => setPro(m === "pro")} className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={on ? { background: "var(--brand-2)", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>;
        })}
      </div>
      {pro && (
        <>
          <Select value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) { setDraft(t.body); if (t.subject) setSubject(t.subject); } }} className="!py-1 text-[11px]">
            <option value="">{templates.length ? "Insert template…" : "No templates yet"}</option>
            {templates.map((t) => { const ok = templateUsable(t); return <option key={t.id} value={t.id} disabled={!ok}>{t.name}{ok ? "" : " · send from a booking"}</option>; })}
          </Select>
          {mergeFieldsFor(composeCtx).map((f) => (
            <button key={f.token} type="button" title={`${f.token} — ${f.desc}`} onClick={() => setDraft((d) => (d ? `${d} ` : "") + f.token)}
              className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{f.token}</button>
          ))}
          <button type="button" onClick={saveTemplate} className="rounded-full border border-dashed border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)]">＋ Save as template</button>
          <Link href={`/${portalSeg}/templates`} className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-3)] no-underline hover:text-[var(--ink)]">⚙ Manage</Link>
        </>
      )}
    </div>
  );

  return (
    // -m-5/p-5 bleeds the light surface to the edges of the (dark-shell) content
    // area so the whole Messages page reads light, like the customer dashboard.
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Messages</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => { setComposing(true); setOpenId(null); setOpenBroadcast(null); setMessages([]); setTarget(""); setSubject(""); setComposeMode("family"); setListingTargets([]); setExcludedEmails([]); setFamilyTargets([]); setNotice(null); }}>
            ＋ {mode === "operator" ? "Message customers" : "New message"}
          </Button>
          {mode === "operator" && portalSeg !== "staff" && (
            <Link href={`/${portalSeg}/activityos`}>
              <Button>✦ Message ActivityOS</Button>
            </Link>
          )}
        </div>
      </div>

      {mode === "operator" && (
        <HowItWorks
          video="Messaging a family, a whole listing (with the recipient review), the Simple/Pro composer with templates + merge fields, and sending a booking-specific message from a booking."
          minutes="2 min"
        >
          <p className="mb-2">
            Message <b>one family</b>, or <b>many at once</b> — pick families, or a <b>whole listing</b> and review who&rsquo;s
            included before sending. A bulk send shows as a single <b>📣 Sent to N families</b> row; any <b>replies come back
            as normal 1:1 conversations</b>.
          </p>
          <p className="mb-2">
            Switch on <b>Pro</b> for saved <b>templates</b> and <b>merge fields</b> — <code>{"{ParentName}"}</code>,
            <code>{" {ChildName}"}</code> and your name fill for each recipient automatically.
          </p>
          <p>
            For a message about a <b>specific booking</b> (its dates &amp; venue), open the booking and hit{" "}
            <b>✉️ Message family</b> — every field fills from that booking, with a live preview before you send.
            Use <b>folders</b> to file conversations, and <b>Message ActivityOS</b> for support.
          </p>
        </HowItWorks>
      )}
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {notice && <div className="mb-3 rounded-lg border border-[var(--green-line,#bfe9d2)] bg-[var(--green-soft,#e7f8ee)] px-3 py-2 text-[12.5px] text-[#0f7a44]">✓ {notice}</div>}

      <div className="grid gap-3 md:grid-cols-[320px_1fr]">
        <Card className="p-1.5">
          {!threads ? <div className="p-4 text-center text-[12px] text-[var(--ink-3)]">Loading…</div>
          : threads.length === 0 ? <div className="p-4 text-center text-[12px] text-[var(--ink-3)]">No conversations yet.</div>
          : (
            <div className="flex flex-col">
              <div className="px-1 pb-1.5">
                {mode === "operator" && (
                  <div className="mb-1.5 flex flex-wrap items-center gap-1">
                    <button type="button" onClick={() => setActiveFolder("all")}
                      className="rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors"
                      style={activeFolder === "all" ? { borderColor: "var(--brand)", background: "var(--brand)", color: "#fff" } : { borderColor: "var(--line)", background: "transparent", color: "var(--ink-3)" }}>
                      All {allThreads.length}
                    </button>
                    {folders.map((f) => {
                      const on = activeFolder === f.id;
                      return (
                        <span key={f.id} className="inline-flex items-center rounded-full border" style={on ? { borderColor: "var(--brand)", background: "var(--brand)", color: "#fff" } : { borderColor: "var(--line)", background: "transparent", color: "var(--ink-3)" }}>
                          <button type="button" onClick={() => setActiveFolder(f.id)} className="py-1 pl-2.5 text-[11px] font-bold">📁 {f.name} {folderCount(f.id)}</button>
                          {on ? (
                            <>
                              <button type="button" onClick={() => renameFolder(f)} title="Rename" className="px-1 text-[11px] leading-none">✎</button>
                              <button type="button" onClick={() => deleteFolder(f)} title="Delete" className="pr-2 text-[13px] leading-none">×</button>
                            </>
                          ) : <span className="pr-2.5" />}
                        </span>
                      );
                    })}
                    <button type="button" onClick={createFolder} className="rounded-full border border-dashed border-[var(--line)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)]">＋ Folder</button>
                  </div>
                )}
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={mode === "operator" ? "Search families or messages…" : "Search providers or messages…"}
                  className="w-full !py-1.5 text-[12.5px]"
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {filterTabs.map((f) => {
                    const on = statusFilter === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setStatusFilter(f.key)}
                        className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors"
                        style={on
                          ? { borderColor: "var(--brand-2)", background: "var(--brand-2)", color: "#fff" }
                          : { borderColor: "var(--line)", background: "transparent", color: "var(--ink-3)" }}
                      >
                        {f.label} <span className={on ? "opacity-80" : ""}>{counts[f.key]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {mode === "operator" && activeFolder === "all" && !q.trim() && broadcasts.length > 0 && (
                <>
                  <div className="px-2.5 pb-1 pt-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">📣 Sent to groups</div>
                  {broadcasts.slice(0, 20).map((b) => (
                    <button key={b.id} type="button" onClick={() => { setOpenBroadcast(b); setOpenId(null); setComposing(false); }}
                      className={`flex items-start gap-2.5 rounded-xl px-2 py-2 text-left transition ${openBroadcast?.id === b.id ? "bg-[var(--panel)] ring-1 ring-[var(--line)]" : "hover:bg-[var(--panel)]"}`}>
                      <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-[14px]" style={{ background: "var(--brand-soft)" }}>📣</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold">Sent to {b.recipientCount ?? b.recipients?.length ?? 0} families</span>
                          <span className="flex-none text-[10px] text-[var(--ink-3)]">{shortWhen(b.sentAt)}</span>
                        </div>
                        <div className="truncate text-[11.5px] text-[var(--ink-3)]">{b.subject ? `${b.subject} · ` : ""}{b.body}</div>
                      </div>
                    </button>
                  ))}
                  <div className="my-1 border-t border-[var(--line)]" />
                </>
              )}
              {shownThreads.map((t) => {
                const initial = (t.parentName || t.parentEmail || t.tenantName || "?").trim()[0]?.toUpperCase() ?? "?";
                const isNew = unread(t) > 0; // unread = "new" → bold; read = normal weight
                return (
                  <button key={t.id} type="button" onClick={() => open(t.id)} className={`flex items-start gap-2.5 rounded-xl px-2 py-2 text-left transition ${openId === t.id ? "bg-[var(--panel)] ring-1 ring-[var(--line)]" : "hover:bg-[var(--panel)]"}`}>
                    <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-[12px] font-extrabold" style={{ background: "var(--brand-soft)", color: "var(--brand-strong)" }}>{initial}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {isNew && <span className="h-2 w-2 flex-none rounded-full" style={{ background: "var(--brand-2)" }} aria-label="new" />}
                        <span className={`min-w-0 flex-1 truncate text-[12.5px] ${isNew ? "font-extrabold text-[var(--ink)]" : "font-medium text-[var(--ink-2)]"}`}>{t.subject || other(t)}</span>
                        <span className="flex-none text-[10px] text-[var(--ink-3)]">{shortWhen(t.lastAt)}</span>
                        {isNew && <Badge tone={{ bg: "var(--brand)", fg: "#fff" }}>{unread(t)}</Badge>}
                      </div>
                      <div className={`truncate text-[11.5px] ${isNew ? "font-semibold text-[var(--ink-2)]" : "text-[var(--ink-3)]"}`}>{t.subject ? `${other(t)} · ` : ""}{t.lastFrom === mine ? "You: " : ""}{t.lastBody}</div>
                    </div>
                  </button>
                );
              })}
              {startable.length > 0 && (
                <>
                  <div className="px-2.5 pb-1 pt-2.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">
                    Start a new conversation
                  </div>
                  {startable.map((s) => (
                    <button key={s.key} type="button" onClick={() => startWith(s.value)} className="flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--panel)]">
                      <span className="truncate text-[12.5px] font-bold">✏️ {s.label}</span>
                      {s.sub && <span className="truncate text-[11.5px] text-[var(--ink-3)]">{s.sub}</span>}
                    </button>
                  ))}
                </>
              )}
              {shownThreads.length === 0 && startable.length === 0 && (
                <div className="p-4 text-center text-[12px] text-[var(--ink-3)]">
                  {qv ? "No matches — check the spelling, or use ＋ New message." : "Nothing matches."}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="flex min-h-[420px] flex-col p-0">
          {openBroadcast ? (
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold">📣 Broadcast · {openBroadcast.recipientCount ?? openBroadcast.recipients?.length ?? 0} families</div>
                  <div className="text-[11px] text-[var(--ink-3)]">Sent {when(openBroadcast.sentAt)}{openBroadcast.subject ? ` · ${openBroadcast.subject}` : ""}</div>
                </div>
                <button type="button" onClick={() => setOpenBroadcast(null)} className="flex-none text-[11.5px] font-bold text-[var(--brand-2)]">Close</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-3 max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] text-white" style={{ background: "var(--brand)" }}>{openBroadcast.body}</div>
                <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Sent to</div>
                <div className="flex flex-col gap-1">
                  {(openBroadcast.recipients ?? []).map((r) => (
                    <div key={r.email} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12px]">
                      <span className="truncate font-semibold">{r.name}</span>
                      <span className="truncate text-[var(--ink-3)]">{r.email}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[11px] text-[var(--ink-3)]">Any replies appear as individual conversations in your inbox.</div>
              </div>
            </div>
          ) : composing ? (
            <div className="flex flex-1 flex-col">
              <div className="border-b border-[var(--line)] p-3">
                {mode === "operator" && (
                  <div className="mb-2 flex gap-1">
                    {([["family", "👤 Families"], ["group", "📋 Listings"]] as const).map(([m, label]) => {
                      const on = composeMode === m;
                      return (
                        <button key={m} type="button" onClick={() => setComposeMode(m)}
                          className="flex-1 rounded-lg border px-2 py-1.5 text-[11.5px] font-bold transition-colors"
                          style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-2)", color: "#fff" } : { borderColor: "var(--line)", background: "transparent", color: "var(--ink-3)" }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mb-1.5 text-[12px] font-bold text-[var(--ink-3)]">
                  {mode === "parent" ? "Message a provider you’ve booked" : composeMode === "group" ? "Message everyone booked on the chosen listings" : "Message one or more families"}
                </div>
                {mode === "operator" && composeMode === "group" ? (
                  <div className="rounded-lg border border-[var(--line)] p-2">
                    {listings.length === 0 ? (
                      <div className="p-2 text-center text-[12px] text-[var(--ink-3)]">No listings found.</div>
                    ) : (() => {
                      const lq = listingQuery.trim().toLowerCase();
                      const shown = listings.filter((l) => !lq || l.toLowerCase().includes(lq));
                      return (
                        <>
                          <div className="mb-1.5 flex items-center justify-between text-[11px] text-[var(--ink-3)]">
                            <button type="button" onClick={() => setPickerOpen((o) => !o)} className="flex items-center gap-1 font-bold text-[var(--ink-2)]">
                              <span className={`inline-block transition-transform ${pickerOpen ? "" : "-rotate-90"}`}>▾</span>
                              {listingTargets.length} selected · {pickerOpen ? "hide list" : "choose listings"}
                            </button>
                            {listingTargets.length > 0 && <button type="button" onClick={() => setListingTargets([])} className="font-bold text-[var(--brand-2)]">Clear</button>}
                          </div>
                          {!pickerOpen && listingTargets.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {listingTargets.map((l) => <span key={l} className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-strong)]">{l}</span>)}
                            </div>
                          )}
                          {pickerOpen && (<>
                          <Input value={listingQuery} onChange={(e) => setListingQuery(e.target.value)} placeholder="Search listings…" className="w-full !py-1.5 text-[12.5px]" />
                          <div className="mt-1.5 flex max-h-[34vh] flex-col gap-0.5 overflow-y-auto">
                            {shown.length === 0 ? (
                              <div className="p-2 text-center text-[12px] text-[var(--ink-3)]">No listings match.</div>
                            ) : shown.map((l) => {
                              const on = listingTargets.includes(l);
                              return (
                                <button key={l} type="button"
                                  onClick={() => setListingTargets((cur) => (on ? cur.filter((x) => x !== l) : [...cur, l]))}
                                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--panel)]"
                                  style={on ? { background: "var(--brand-soft)" } : undefined}>
                                  <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-md border text-[11px] font-extrabold text-white"
                                    style={on ? { background: "var(--brand-2)", borderColor: "var(--brand-2)" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
                                    {on ? "✓" : ""}
                                  </span>
                                  <span className="truncate text-[12.5px] font-semibold" style={{ color: on ? "var(--brand-strong)" : "var(--ink)" }}>{l}</span>
                                </button>
                              );
                            })}
                          </div>
                          </>)}
                        </>
                      );
                    })()}
                  </div>
                ) : mode === "parent" ? (
                  providers.length <= 1 ? (
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[13px] font-bold">
                      {providers[0]?.name ?? "Your provider"}
                    </div>
                  ) : (
                    <Select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full">
                      <option value="">Choose…</option>
                      {providers.map((p) => <option key={p.tenantId} value={p.tenantId}>{p.name}</option>)}
                    </Select>
                  )
                ) : (() => {
                  // Searchable, multi-select family picker (tick one or many).
                  const fq = familyQuery.trim().toLowerCase();
                  const matches = customers.filter((c) => !fq || `${c.name ?? ""} ${c.email ?? ""} ${c.locationName ?? ""} ${(c.children ?? []).map((k) => k.name).join(" ")}`.toLowerCase().includes(fq));
                  return (
                    <div className="rounded-lg border border-[var(--line)] p-2">
                      <div className="mb-1.5 flex items-center justify-between text-[11px] text-[var(--ink-3)]">
                        <button type="button" onClick={() => setPickerOpen((o) => !o)} className="flex items-center gap-1 font-bold text-[var(--ink-2)]">
                          <span className={`inline-block transition-transform ${pickerOpen ? "" : "-rotate-90"}`}>▾</span>
                          {familyTargets.length} selected · {pickerOpen ? "hide list" : "choose families"}
                        </button>
                        {familyTargets.length > 0 && <button type="button" onClick={() => setFamilyTargets([])} className="font-bold text-[var(--brand-2)]">Clear</button>}
                      </div>
                      {!pickerOpen && familyTargets.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {familyTargets.map((em) => { const c = customers.find((x) => x.email === em); return <span key={em} className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-strong)]">{c?.name || em}</span>; })}
                        </div>
                      )}
                      {pickerOpen && (<>
                      <Input value={familyQuery} onChange={(e) => setFamilyQuery(e.target.value)} placeholder="Search families by name, place or email…" className="w-full !py-1.5 text-[12.5px]" />
                      <div className="mt-1.5 flex max-h-[38vh] min-h-[120px] flex-col gap-0.5 overflow-y-auto">
                        {matches.length === 0 ? (
                          <div className="p-3 text-center text-[12px] text-[var(--ink-3)]">No families match.</div>
                        ) : matches.slice(0, 120).map((c) => {
                          const email = c.email || "";
                          const on = familyTargets.includes(email);
                          return (
                            <button key={c.id} type="button"
                              onClick={() => { if (!email) return; setFamilyTargets((cur) => (on ? cur.filter((x) => x !== email) : [...cur, email])); }}
                              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--panel)]"
                              style={on ? { background: "var(--brand-soft)" } : undefined}>
                              <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-md border text-[11px] font-extrabold text-white"
                                style={on ? { background: "var(--brand-2)", borderColor: "var(--brand-2)" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
                                {on ? "✓" : ""}
                              </span>
                              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[12px] font-extrabold" style={{ background: "var(--brand-soft)", color: "var(--brand-strong)" }}>
                                {(c.name || c.email || "?").trim()[0]?.toUpperCase() ?? "?"}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12.5px] font-bold" style={{ color: on ? "var(--brand-strong)" : "var(--ink)" }}>{c.name || c.email}</div>
                                <div className="truncate text-[11px] text-[var(--ink-3)]">{familySub(c)}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      </>)}
                    </div>
                  );
                })()}
                {composeMode === "group" && listingTargets.length > 0 && listingRecipients.length > 0 && (() => {
                  const included = listingRecipients.filter((r) => !excludedEmails.includes(r.email));
                  return (
                    <details className="mt-2 rounded-lg border border-[var(--line)] p-2" open>
                      <summary className="cursor-pointer text-[11.5px] font-bold text-[var(--ink-2)]">
                        Going to <b className="text-[var(--brand-strong)]">{included.length}</b> of {listingRecipients.length} families — click to review / un-tick
                      </summary>
                      <div className="mt-1.5 flex max-h-[30vh] flex-col gap-0.5 overflow-y-auto">
                        {listingRecipients.map((r) => {
                          const on = !excludedEmails.includes(r.email);
                          return (
                            <button key={r.email} type="button"
                              onClick={() => setExcludedEmails((ex) => (on ? [...ex, r.email] : ex.filter((e) => e !== r.email)))}
                              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--panel)]"
                              style={on ? undefined : { opacity: 0.5 }}>
                              <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-md border text-[11px] font-extrabold text-white"
                                style={on ? { background: "var(--brand-2)", borderColor: "var(--brand-2)" } : { borderColor: "var(--line)", background: "var(--surface)" }}>{on ? "✓" : ""}</span>
                              <span className="min-w-0 flex-1 truncate text-[12px]"><b>{r.name}</b>{r.child ? ` · ${r.child}` : ""} <span className="text-[var(--ink-3)]">· {r.email}</span></span>
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  );
                })()}
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject (optional)"
                  maxLength={80}
                  className="mt-2 w-full !py-1.5 text-[12.5px]"
                />
                {composeMode === "group" && (
                  <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">Sends one message to each ticked family booked on the chosen listings.</div>
                )}
              </div>
              {proBar}
              <Composer draft={draft} setDraft={setDraft} onSend={send} big />
            </div>
          ) : !active ? (
            <div className="flex flex-1 items-center justify-center text-[12.5px] text-[var(--ink-3)]">Pick a conversation, or start a new one.</div>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-extrabold">{active.subject || other(active)}</div>
                  {active.subject && <div className="truncate text-[11px] text-[var(--ink-3)]">{other(active)}</div>}
                </div>
                {mode === "operator" && (
                  <label className="flex flex-none items-center gap-1 text-[11px] font-bold text-[var(--ink-3)]">
                    Move to
                    <Select
                      value={active.folderId ?? ""}
                      onChange={async (e) => {
                        const v = e.target.value;
                        if (v === "__new") {
                          const name = window.prompt("New folder name (e.g. Resolved)")?.trim();
                          if (!name) return;
                          try {
                            const f = await apiPost<{ id: string }>("/api/messages/folders", { name });
                            loadFolders();
                            moveThread(active.id, f.id);
                          } catch (err) { setError(err instanceof Error ? err.message : "Couldn’t create folder"); }
                          return;
                        }
                        moveThread(active.id, v || null);
                      }}
                      className="!py-1 text-[11.5px]"
                    >
                      <option value="">🗂 No folder</option>
                      {folders.map((f) => <option key={f.id} value={f.id}>📁 {f.name}</option>)}
                      <option disabled>──────────</option>
                      <option value="__new">＋ New folder…</option>
                    </Select>
                  </label>
                )}
              </div>
              {/* Legend — blue is you, pink is the other side, at a glance. */}
              <div className="flex items-center gap-3 border-b border-[var(--line)] px-3.5 py-1.5 text-[10px] font-bold text-[var(--ink-3)]">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--brand)" }} /> You</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: "#ee1f63" }} /> {mine === "operator" ? "Customer" : "Provider"}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3.5">
                <div className="flex flex-col gap-2">
                  {messages.map((m) => {
                    const isMine = m.from === mine;
                    const label = isMine ? "You" : (m.senderName || (mine === "operator" ? "Customer" : "Provider"));
                    return (
                      <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-[13px] text-white ${isMine ? "self-end" : "self-start"}`} style={{ background: isMine ? "var(--brand)" : "#ee1f63" }}>
                        <div className="whitespace-pre-wrap">{m.body}</div>
                        <div className="mt-0.5 text-[10px] text-white/75">{label} · {when(m.createdAt)}</div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
              </div>
              {proBar}
              <Composer draft={draft} setDraft={setDraft} onSend={send} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Composer({ draft, setDraft, onSend, big }: { draft: string; setDraft: (v: string) => void; onSend: () => void; big?: boolean }) {
  const lines = draft.split("\n").length;
  return (
    <div className="flex items-end gap-2 border-t border-[var(--line)] p-2.5">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
        placeholder="Write a message…  (Enter to send · Shift+Enter for a new line)"
        rows={big ? Math.min(16, Math.max(7, lines)) : Math.min(10, Math.max(2, lines))}
        className={`flex-1 resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-[1.5] text-[var(--ink)] outline-none focus:border-[var(--brand-2)] ${big ? "max-h-[440px] min-h-[200px]" : "max-h-[240px] min-h-[44px]"}`}
      />
      <Button variant="primary" onClick={onSend} disabled={!draft.trim()}>Send</Button>
    </div>
  );
}
