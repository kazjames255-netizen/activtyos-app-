"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Card } from "@/components/ui";
import { NotesThread } from "./NotesThread";

interface Rec {
  id: string; kind: string; childName: string; date?: string; time?: string; location?: string;
  description?: string; injury?: string; treatment?: string; firstAider?: string; severity?: string;
  incidentType?: string; actionTaken?: string; attachments?: string[];
  parentNotified?: boolean; parentNotifiedAt?: string; followUp?: string; createdAt?: string; updatedAt?: string;
  acknowledgedAt?: string; acknowledgedBy?: string; requireAck?: boolean;
  notes?: { by: string; role: string; text: string; at: string }[];
}
const isBehaviour = (r: Rec) => r.kind === "incident";
const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;
const SEV: Record<string, { label: string; bg: string; fg: string }> = {
  minor: { label: "Minor", bg: "#eaf0fc", fg: "#1d3a8f" }, moderate: { label: "Moderate", bg: "#fdf3d8", fg: "#9a5a00" }, serious: { label: "Serious", bg: "#fdebec", fg: "#c02636" },
};
const fmtDate = (d?: string, t?: string) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) + (t ? ` · ${t}` : "") : "");
const stamp = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export function ParentAccidentsApp() {
  const [records, setRecords] = useState<Rec[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"accident" | "incident">("accident");
  const [acking, setAcking] = useState<string | null>(null);
  const [muted, setMuted] = useState(() => typeof window !== "undefined" && localStorage.getItem("aos.accidentNotifyMuted") === "1");
  const toggleMute = () => setMuted((m) => { const n = !m; try { localStorage.setItem("aos.accidentNotifyMuted", n ? "1" : "0"); } catch { /* ignore */ } return n; });

  const refresh = useCallback(() => {
    // Accidents + any behaviour records the provider chose to share (the server
    // hides internal behaviour and confidential safeguarding).
    apiGet<Rec[]>("/api/incidents").then((r) => { setRecords([...r].sort((a, b) => `${b.date ?? ""}${b.time ?? ""}`.localeCompare(`${a.date ?? ""}${a.time ?? ""}`))); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["children", "incidents"], refresh);
  // Only nag for records whose provider requires acknowledgement.
  const outstanding = (records ?? []).filter((r) => !r.acknowledgedAt && r.requireAck);
  const inTab = (r: Rec) => (tab === "incident" ? isBehaviour(r) : r.kind === "accident");
  const view = (records ?? []).filter(inTab);
  const nAcc = (records ?? []).filter((r) => r.kind === "accident").length;
  const nInc = (records ?? []).filter(isBehaviour).length;
  const TAB = tab === "incident"
    ? { key: "incident" as const, c: "#6d28d9", bg: "#f3e8ff", icon: "🧩", label: "Incidents", empty: "No behaviour updates have been shared with you. 🎉" }
    : { key: "accident" as const, c: "#c02636", bg: "#fdebec", icon: "⛑️", label: "Accidents", empty: "No accident records — nothing’s been logged for your child. 🎉" };

  async function acknowledge(id: string) {
    setAcking(id); setError(null);
    try { await apiPost(`/api/incidents/${encodeURIComponent(id)}/acknowledge`, {}); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); }
    finally { setAcking(null); }
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">⛑️</span>First aid &amp; incidents
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Accidents, and any behaviour updates the provider shares with you, appear here — with a place to reply and to confirm you&rsquo;ve seen them.</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {([["accident", "⛑️", "Accidents", nAcc], ["incident", "🧩", "Incidents", nInc]] as [("accident" | "incident"), string, string, number][]).map(([k, ic, lbl, n]) => (
            <button key={k} type="button" onClick={() => { setTab(k); setOpenId(null); }} className="rounded-full px-4 py-2 text-[13px] font-extrabold transition-colors" style={tab === k ? { background: "#fff", color: k === "incident" ? "#6d28d9" : "#c02636" } : { background: "rgba(255,255,255,0.16)", color: "#fff" }}>{ic} {lbl}{n ? ` (${n})` : ""}</button>
          ))}
        </div>
      </div>

      {records && outstanding.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-[#f0b100] bg-[#fff8e6] px-4 py-3">
          <span className="text-[13px] font-bold text-[#8a5a00]">⚠️ Please confirm you&rsquo;ve seen {outstanding.length === 1 ? "an accident record" : `${outstanding.length} accident records`} for your child, so staff know you&rsquo;re aware.</span>
          <button type="button" onClick={() => { setOpenId(outstanding[0].id); document.getElementById(`rec-${outstanding[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="rounded-full bg-[#1d3a8f] px-4 py-1.5 text-[12.5px] font-extrabold text-white">Review &amp; acknowledge →</button>
        </div>
      )}

      {records && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5">
          <span className="text-[12.5px] text-[var(--ink-2)]">{muted ? "🔕 Accident alerts are off — you're checking here yourself." : "🔔 We'll email you and ring the bell here whenever an accident is logged."}</span>
          <button type="button" onClick={toggleMute} className="rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors" style={muted ? { borderColor: "#1d3a8f", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{muted ? "🔔 Turn alerts back on" : "🔕 Stop notifying me"}</button>
        </div>
      )}

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {!records ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : view.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{TAB.empty}</Card>
      : (
        <div className="flex flex-col gap-2.5">
          {view.map((r) => {
            const sev = SEV[r.severity ?? "minor"] ?? SEV.minor;
            const stripe = isBehaviour(r) ? "#6d28d9" : sev.fg;
            return (
              <Card key={r.id} id={`rec-${r.id}`} className="overflow-hidden p-0">
                <div className="h-1.5 w-full" style={{ background: stripe }} />
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-[16px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{r.childName}</span>
                        {isBehaviour(r) ? <span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[11px] font-bold text-[#1d3a8f]">🧩 Behaviour{r.incidentType ? ` · ${r.incidentType}` : ""}</span> : r.injury && <span className="text-[13px] text-[var(--ink-2)]">{r.injury}</span>}
                      </div>
                      {r.description && <p className="mt-1 max-w-[640px] text-[13px] leading-snug text-[var(--ink-2)]">{r.description}</p>}
                    </div>
                    <div className="flex flex-col items-start gap-1.5 sm:items-end">
                      <Badge tone={{ bg: sev.bg, fg: sev.fg }}>{sev.label}</Badge>
                      <span className="text-[11.5px] font-bold text-[var(--ink-2)]">{fmtDate(r.date, r.time)}</span>
                      {(r.parentNotified || r.parentNotifiedAt) && <Badge tone={{ bg: "#eaf0fc", fg: "#1d3a8f" }}>you were notified{r.parentNotifiedAt ? ` · ${stamp(r.parentNotifiedAt)}` : ""}</Badge>}
                      {r.updatedAt && <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>✏️ Updated by the provider · {stamp(r.updatedAt)}</Badge>}
                      {r.acknowledgedAt && <Badge tone={{ bg: "#e7f6ee", fg: "#0f7a43" }}>✓ You acknowledged · {stamp(r.acknowledgedAt)}</Badge>}
                    </div>
                  </div>
                  <div className="mt-3 border-t border-[var(--line)] pt-2.5">
                    <button type="button" onClick={() => setOpenId(openId === r.id ? null : r.id)} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">{openId === r.id ? "Hide details" : "See details"}</button>
                  </div>
                  {openId === r.id && (
                    <div className="mt-2 flex flex-col gap-1.5 rounded-xl bg-[var(--panel)] px-3.5 py-3 text-[12.5px] text-[var(--ink-2)]">
                      {r.location && <div><b className="text-[var(--ink)]">Where:</b> {r.location}</div>}
                      {isBehaviour(r) ? (
                        r.actionTaken && <div><b className="text-[var(--ink)]">What we did:</b> {r.actionTaken}</div>
                      ) : (
                        <>
                          {r.treatment && <div><b className="text-[var(--ink)]">First aid:</b> {r.treatment}</div>}
                          <div><b className="text-[var(--ink)]">First aid given by:</b> {r.firstAider ? r.firstAider : "not recorded"}</div>
                        </>
                      )}
                      {r.followUp && <div><b className="text-[var(--ink)]">Follow-up:</b> {r.followUp}</div>}
                      {(r.attachments?.length ?? 0) > 0 && <div><b className="text-[var(--ink)]">Attached:</b> {r.attachments!.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="mr-2 font-bold text-[#1d3a8f] underline">📎 file {i + 1}</a>)}</div>}
                    </div>
                  )}

                  {/* Reply thread — always visible so a parent can message back and forth */}
                  <div className="mt-3 rounded-xl border border-[#cfe0f7] bg-[#f4f8ff] p-3">
                    <div className="text-[12px] font-extrabold text-[#1d3a8f]">💬 Message the provider</div>
                    <p className="mt-0.5 text-[11px] text-[var(--ink-3)]">Ask a question or reply — the team sees it here and can write back. You&rsquo;ll get a bell when they do.</p>
                    <NotesThread id={r.id} notes={r.notes} side="parent" onAdded={refresh} />
                  </div>

                  {r.acknowledgedAt ? (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#cfe9d8] bg-[#eef8f1] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#0f7a43]">
                      ✓ You confirmed you&rsquo;ve seen this on {stamp(r.acknowledgedAt)} — the team has been told.
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#cfe0f7] bg-[#f4f8ff] px-3.5 py-2.5">
                      <span className="text-[12.5px] font-semibold text-[var(--ink-2)]">Please confirm you&rsquo;ve seen this so staff know you&rsquo;re aware.</span>
                      <button type="button" disabled={acking === r.id} onClick={() => acknowledge(r.id)}
                        className="rounded-full bg-[#1d3a8f] px-4 py-1.5 text-[12.5px] font-extrabold text-white shadow-sm transition-transform hover:-translate-y-px disabled:opacity-60">
                        {acking === r.id ? "Saving…" : "✓ I acknowledge this"}
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
