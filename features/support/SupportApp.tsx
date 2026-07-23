"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Button, Card, Input, Select } from "@/components/ui";

// Matches the light surface the Messages view uses (mirror of the custdash palette).
const LIGHT_PALETTE = {
  "--bg": "#f5f8fd",
  "--surface": "#ffffff",
  "--panel": "#fbf8fc",
  "--ink": "#171534",
  "--ink-2": "#4a4763",
  "--ink-3": "#8a86a3",
  "--line": "#ece6f1",
} as CSSProperties;

const OPERATOR_TOPICS: [string, string][] = [
  ["general", "General question"],
  ["billing", "Billing & payouts"],
  ["bug", "Something’s broken"],
  ["feature", "Feature request"],
  ["onboarding", "Account & onboarding"],
  ["compliance", "Compliance"],
];
const CUSTOMER_TOPICS: [string, string][] = [
  // Customers use this ONLY for app problems — bookings/payments go to their
  // provider, not ActivityOS.
  ["bug", "Something’s not working"],
  ["error", "A page or button broke"],
  ["account", "Login / account issue"],
  ["other", "Other app problem"],
];
const topicLabel = (topics: [string, string][], t?: string) => topics.find(([v]) => v === t)?.[1] ?? topics[0]?.[1] ?? "";

interface SupportMsg { id: string; from: string; senderName?: string; topic?: string; subject?: string; body: string; createdAt?: string }
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

/** A separate support channel between the provider and ActivityOS/HQ. */
export function SupportApp() {
  const [msgs, setMsgs] = useState<SupportMsg[] | null>(null);
  const [topic, setTopic] = useState("general");
  const [subject, setSubject] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const portalSeg = usePathname().split("/")[1] || "freelancer";
  const isCustomer = portalSeg === "custdash";
  const TOPICS = isCustomer ? CUSTOMER_TOPICS : OPERATOR_TOPICS;
  // Default the topic to the first one for this side (customers have no "general").
  useEffect(() => { setTopic(TOPICS[0]?.[0] ?? "general"); }, [isCustomer]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(() => {
    apiGet<SupportMsg[]>("/api/messages/support").then(setMsgs).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtime(["support"], load);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  async function send() {
    if (!draft.trim()) return;
    setBusy(true); setError(null);
    try {
      await apiPost("/api/messages/support", { topic, subject: subject.trim() || undefined, body: draft.trim() });
      setDraft(""); setSubject(""); load();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t send"); }
    finally { setBusy(false); }
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{isCustomer ? "Report a problem" : "✦ Message ActivityOS"}</h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">{isCustomer ? "Something not working in the app? Tell our support team. For anything about your bookings or payments, message your provider instead." : "Support, billing and anything about the platform — separate from your customer messages."}</p>
        </div>
        <Link href={`/${portalSeg}/messages`}><Button>← Back to messages</Button></Link>
      </div>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      <Card className="mx-auto flex min-h-[440px] max-w-[760px] flex-col p-0">
        <div className="flex-1 overflow-y-auto p-4">
          {!msgs ? (
            <div className="p-6 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
          ) : msgs.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-[var(--ink-3)]">
              {isCustomer ? "No reports yet — tell us about any problem with the app below and we’ll get back to you." : "No messages yet — send ActivityOS a note below and we’ll get back to you."}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {msgs.map((m) => {
                const mine = m.from !== "activityos";
                return (
                  <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] ${mine ? "self-end bg-[var(--brand)] text-white" : "self-start bg-[var(--panel)] text-[var(--ink)]"}`}>
                    {(m.subject || m.topic) && (
                      <div className={`mb-0.5 text-[10px] font-bold uppercase tracking-[0.04em] ${mine ? "text-white/75" : "text-[var(--ink-3)]"}`}>
                        {topicLabel(TOPICS, m.topic)}{m.subject ? ` · ${m.subject}` : ""}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{m.body}</div>
                    <div className={`mt-0.5 text-[10px] ${mine ? "text-white/70" : "text-[var(--ink-3)]"}`}>
                      {mine ? "You" : (isCustomer ? "Support" : "ActivityOS")} · {when(m.createdAt)}
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="border-t border-[var(--line)] p-2.5">
          <div className="mb-2 flex flex-wrap gap-2">
            <Select value={topic} onChange={(e) => setTopic(e.target.value)} className="!py-1.5 text-[12.5px]">
              {TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={80} placeholder="Subject (optional)" className="min-w-[160px] flex-1 !py-1.5 text-[12.5px]" />
          </div>
          <div className="flex items-center gap-2">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={isCustomer ? "Describe the problem…" : "Write your message to ActivityOS…"} className="flex-1" />
            <Button variant="primary" onClick={send} disabled={busy || !draft.trim()}>{busy ? "Sending…" : "Send"}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
