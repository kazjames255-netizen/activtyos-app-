"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card, FieldLabel, Input, Select } from "@/components/ui";

interface Sent { id: string; subject: string; audience: string; recipientCount: number; sentByName?: string; createdAt?: string }
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export function EmailApp() {
  const [history, setHistory] = useState<Sent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [audience, setAudience] = useState<"all" | "one">("all");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reach, setReach] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Sent[]>("/api/emails").then((h) => { setHistory(h); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ count: number }>("/api/emails/recipients").then((r) => setReach(r.count)).catch(() => {}); }, []);
  useRealtime(["emails", "bookings"], () => { refresh(); apiGet<{ count: number }>("/api/emails/recipients").then((r) => setReach(r.count)).catch(() => {}); });

  async function send() {
    if (!subject.trim() || !body.trim()) { setError("A subject and a message are required."); return; }
    if (audience === "one" && !to.trim()) { setError("Enter a recipient address."); return; }
    const count = audience === "one" ? 1 : reach ?? 0;
    if (!confirm(audience === "one" ? `Send this email to ${to}?` : `Send this email to ${count} famil${count === 1 ? "y" : "ies"}?`)) return;
    setSending(true); setError(null); setOk(null);
    try {
      const r = await apiPost<{ recipientCount: number }>("/api/emails/send", { subject, body, audience, to: audience === "one" ? to : undefined });
      setOk(`Sent to ${r.recipientCount} recipient${r.recipientCount === 1 ? "" : "s"}.`);
      setSubject(""); setBody(""); setTo(""); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t send"); }
    finally { setSending(false); }
  }

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Email</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Email your families out of app — everyone who’s booked, or a single address.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12.5px] text-[#1d3a8f]">{ok}</div>}

      <Card className="mb-4 p-4">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <FieldLabel>Audience</FieldLabel>
            <Select value={audience} onChange={(e) => setAudience(e.target.value as "all" | "one")} className="w-full">
              <option value="all">All families{reach != null ? ` (${reach})` : ""}</option>
              <option value="one">A single address</option>
            </Select>
          </div>
          {audience === "one" && <div><FieldLabel>Recipient</FieldLabel><Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" className="w-full" /></div>}
        </div>
        <div className="mt-2.5"><FieldLabel>Subject</FieldLabel><Input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full" /></div>
        <div className="mt-2.5"><FieldLabel>Message</FieldLabel><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px]" /></div>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="primary" onClick={send} disabled={sending}>{sending ? "Sending…" : audience === "one" ? "Send email" : `Send to ${reach ?? 0} famil${reach === 1 ? "y" : "ies"}`}</Button>
          {audience === "all" && reach === 0 && <span className="text-[11.5px] text-[var(--ink-3)]">No booked families to email yet.</span>}
        </div>
      </Card>

      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Sent</div>
      {!history ? <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : history.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">Nothing sent yet.</Card>
      : (
        <div className="flex flex-col gap-1.5">
          {history.map((h) => (
            <Card key={h.id} className="flex flex-wrap items-center gap-2 p-2.5">
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{h.subject}</span>
              <Badge tone={{ bg: "var(--panel)", fg: "var(--ink-2)" }}>{h.audience === "one" ? "1 address" : `${h.recipientCount} famil${h.recipientCount === 1 ? "y" : "ies"}`}</Badge>
              <span className="text-[11px] text-[var(--ink-3)]">{h.sentByName} · {when(h.createdAt)}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
