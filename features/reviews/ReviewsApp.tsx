"use client";

// Operator Reviews hub — in-house feedback blended with Google/Trustpilot into
// one score + one inbox. Reply to in-house reviews inline. Connect external
// sources in Setup → Reviews. No review gating: the Google invite goes to every
// customer (see the parent feedback page).
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { Button, Card } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";

interface Review { source: "inhouse" | "google" | "trustpilot"; rating: number; author: string; text: string; postedAt: string; url?: string; listing?: string | null; verified: boolean; reply?: { text: string; at: string } | null; id?: string }
interface SourceStat { rating: number | null; count: number }
interface Hub { summary: { rating: number | null; count: number }; bySource: { inhouse: SourceStat; google: SourceStat | null; trustpilot: SourceStat | null }; items: Review[]; googleConnectConfigured: boolean; trustpilotConfigured: boolean }

const SRC = {
  inhouse: { label: "In-house", dot: "#1d3a8f", bg: "#eef4fd" },
  google: { label: "Google", dot: "#ea4335", bg: "#fdecec" },
  trustpilot: { label: "Trustpilot", dot: "#00b67a", bg: "#e6f7ef" },
} as const;
const Stars = ({ n, size = 14 }: { n: number; size?: number }) => (
  <span style={{ fontSize: size, letterSpacing: 1, color: "#f5b301" }}>{"★".repeat(Math.round(n))}<span style={{ color: "#d9d5e4" }}>{"★".repeat(5 - Math.round(n))}</span></span>
);
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

export function ReviewsApp() {
  const portal = usePathname().split("/")[1] || "company";
  const [hub, setHub] = useState<Hub | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "inhouse" | "google" | "trustpilot">("all");

  const load = () => apiGet<Hub>("/api/reviews").then(setHub).catch(() => {});
  useEffect(() => { void load(); }, []);

  const sendReply = async (id: string) => {
    if (!replyText.trim() || busy) return;
    setBusy(true);
    try { await apiPost(`/api/reviews/inhouse/${id}/reply`, { text: replyText.trim() }); setReplyFor(null); setReplyText(""); await load(); }
    catch { /* ignore */ } finally { setBusy(false); }
  };

  const items = useMemo(() => (hub?.items ?? []).filter((r) => filter === "all" || r.source === filter), [hub, filter]);
  const connectGoogle = async () => {
    try { const r = await apiGet<{ authUrl?: string; needsPlatformSetup?: boolean; error?: string }>("/api/reviews/google/connect"); if (r.authUrl) window.location.href = r.authUrl; }
    catch (e) { alert(e instanceof Error ? e.message : "Google connect isn't available yet."); }
  };

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Reviews" icon="⭐" lede="Your in-house feedback blended with Google and Trustpilot — one score, one inbox. Connect sources in Setup." actions={<Link href={`/${portal}/setup?tab=reviews`}><Button sm variant="primary">Connect sources</Button></Link>} />

      {/* Blended score + per-source */}
      <div className="mb-3 grid gap-3 md:grid-cols-[1.1fr_1.4fr]">
        <Card className="flex items-center gap-4 p-5">
          <div className="text-center">
            <div className="text-[44px] font-black leading-none text-[#1d3a8f]" style={{ fontFamily: "var(--ff-display)" }}>{hub?.summary.rating != null ? hub.summary.rating.toFixed(1) : "—"}</div>
            <div className="mt-1"><Stars n={hub?.summary.rating ?? 0} size={16} /></div>
            <div className="mt-1 text-[11.5px] font-bold text-[var(--ink-3)]">{hub?.summary.count ?? 0} review{(hub?.summary.count ?? 0) === 1 ? "" : "s"}</div>
          </div>
          <div className="flex-1 border-l border-[var(--line)] pl-4">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Blended rating</div>
            <p className="mt-1 text-[12px] text-[var(--ink-2)]">A weighted average across every connected source. Add Google or Trustpilot in Setup to raise your visible count.</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">By source</div>
          <div className="grid grid-cols-3 gap-2.5">
            {(["inhouse", "google", "trustpilot"] as const).map((k) => {
              const s = k === "inhouse" ? hub?.bySource.inhouse : hub?.bySource[k];
              const meta = SRC[k];
              return (
                <div key={k} className="rounded-xl border border-[var(--line)] p-3" style={{ background: meta.bg }}>
                  <div className="flex items-center gap-1.5 text-[11.5px] font-extrabold text-[var(--ink)]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.dot }} />{meta.label}</div>
                  {s ? <><div className="mt-1 text-[19px] font-black tabular-nums text-[var(--ink)]">{s.rating != null ? s.rating.toFixed(1) : "—"}</div><div className="text-[10.5px] font-bold text-[var(--ink-3)]">{s.count} review{s.count === 1 ? "" : "s"}</div></>
                    : <div className="mt-1.5 text-[11px] font-semibold text-[var(--ink-3)]">Not connected</div>}
                </div>
              );
            })}
          </div>
          {!hub?.bySource.google && <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--ink-3)]"><span>Show your Google rating:</span><Link href={`/${portal}/setup?tab=reviews`} className="font-bold text-[#1d3a8f] hover:underline">add your Place ID →</Link>{hub?.googleConnectConfigured && <button type="button" onClick={connectGoogle} className="rounded-full bg-[#1d3a8f] px-2.5 py-1 text-[11px] font-bold text-white">Connect Google Business Profile</button>}</div>}
        </Card>
      </div>

      {/* Filter */}
      <div className="mb-2 inline-flex flex-wrap items-center gap-1 rounded-xl border border-[var(--line)] bg-white p-1">
        {([["all", "All"], ["inhouse", "In-house"], ["google", "Google"], ["trustpilot", "Trustpilot"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={"rounded-lg px-3.5 py-1.5 text-[12.5px] font-extrabold " + (filter === k ? "bg-[#1d3a8f] text-white" : "text-[var(--ink-2)]")}>{l}</button>
        ))}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <Card className="p-10 text-center text-[13px] text-[var(--ink-3)]">No reviews here yet. In-house feedback lands here automatically; connect Google/Trustpilot in Setup to pull those in.</Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((r, i) => {
            const meta = SRC[r.source];
            return (
              <Card key={r.id ?? `${r.source}-${i}`} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: meta.bg, color: meta.dot }}>{meta.label}</span>
                  <Stars n={r.rating} />
                  <span className="text-[13px] font-bold text-[var(--ink)]">{r.author}</span>
                  {r.verified && r.source === "inhouse" && <span className="rounded-full bg-[#e7f5ec] px-1.5 py-0.5 text-[9.5px] font-black uppercase text-[#0f7a43]">Verified booking</span>}
                  {r.listing && <span className="text-[11.5px] text-[var(--ink-3)]">· {r.listing}</span>}
                  <span className="ml-auto text-[11px] text-[var(--ink-3)]">{fmt(r.postedAt)}</span>
                </div>
                {r.text && <p className="mt-1.5 text-[13px] leading-[1.55] text-[var(--ink-2)]">{r.text}</p>}
                {r.reply && <div className="mt-2 rounded-lg border-l-2 border-[#1d3a8f] bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-2)]"><b className="text-[var(--ink)]">Your reply:</b> {r.reply.text}</div>}
                {r.source === "inhouse" && !r.reply && (
                  replyFor === r.id ? (
                    <div className="mt-2">
                      <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} placeholder="Thanks for the feedback…" className="w-full rounded-lg border border-[var(--line)] bg-white p-2 text-[12.5px]" />
                      <div className="mt-1.5 flex gap-2"><Button sm variant="primary" disabled={busy || !replyText.trim()} onClick={() => sendReply(r.id!)}>Send reply</Button><button type="button" onClick={() => { setReplyFor(null); setReplyText(""); }} className="text-[12px] font-bold text-[var(--ink-3)]">Cancel</button></div>
                    </div>
                  ) : <button type="button" onClick={() => { setReplyFor(r.id!); setReplyText(""); }} className="mt-2 rounded-full border border-[var(--line)] px-3 py-1 text-[11.5px] font-bold text-[#1d3a8f] hover:bg-[var(--panel)]">Reply</button>
                )}
                {r.source !== "inhouse" && r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[11.5px] font-bold text-[#1d3a8f] hover:underline">Reply on {meta.label} ↗</a>}
              </Card>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">Compliant by design: every customer is invited to review on Google after leaving feedback — never only the happy ones.</p>
    </div>
  );
}
