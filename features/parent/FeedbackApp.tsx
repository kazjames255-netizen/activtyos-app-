"use client";

// Parent feedback / review — reached from the "How did we do?" prompt. Pick the
// provider (pre-filled from the notification link), leave a star rating and a
// note. Stored via /api/my/feedback so the family can see what they've sent.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { Card } from "@/components/ui";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as React.CSSProperties;

interface Provider { tenantId: string; name: string }
interface Feedback { id: string; tenantId: string; rating: number; comment?: string; listing?: string | null; createdAt: string }
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const STARS = [1, 2, 3, 4, 5];
const RATING_WORD = ["", "Poor", "Could be better", "Good", "Great", "Excellent"];

export function FeedbackApp() {
  const sp = useSearchParams();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [mine, setMine] = useState<Feedback[]>([]);
  const [tenantId, setTenantId] = useState(sp.get("p") ?? "");
  const [listing, setListing] = useState(sp.get("listing") ?? "");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);

  const refreshMine = () => apiGet<Feedback[]>("/api/my/feedback").then(setMine).catch(() => {});
  useEffect(() => {
    apiGet<Provider[]>("/api/my/providers").then((ps) => { setProviders(ps || []); if (!tenantId && ps?.length === 1) setTenantId(ps[0].tenantId); }).catch(() => {});
    void refreshMine();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const providerName = useMemo(() => providers.find((p) => p.tenantId === tenantId)?.name ?? "your provider", [providers, tenantId]);
  const valid = !!tenantId && rating >= 1;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true); setError(null);
    try {
      await apiPost("/api/my/feedback", { tenantId, rating, comment: comment.trim() || undefined, listing: listing.trim() || undefined });
      // Compliant: invite EVERYONE (any score) to also review on Google.
      apiGet<{ url: string | null }>(`/api/reviews/invite/${tenantId}`).then((r) => setGoogleUrl(r.url)).catch(() => {});
      setSent(true); setComment(""); setRating(0);
      await refreshMine();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't send your feedback"); }
    finally { setBusy(false); }
  };

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), linear-gradient(120deg,#16306e 0%,#3f78d8 100%)", backgroundSize: "18px 18px, cover", backgroundRepeat: "repeat, no-repeat" }}>
        <h2 className="m-0 flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/20 text-[17px]">⭐</span>Leave feedback</h2>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">How did your sessions go? A quick rating and a few words genuinely help — and let your provider know what to keep doing.</p>
      </div>

      {sent ? (
        <Card className="p-6 text-center">
          <div className="text-[34px]">🎉</div>
          <div className="mt-1 text-[16px] font-extrabold text-[var(--ink)]">Thank you!</div>
          <p className="mx-auto mt-1 max-w-[440px] text-[13px] text-[var(--ink-3)]">That&rsquo;s everything — your feedback is in with <b className="text-[var(--ink-2)]">{providerName}</b> and it really helps them.</p>
          {googleUrl && (
            <div className="mx-auto mt-4 max-w-[440px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3.5">
              <div className="text-[12px] font-semibold text-[var(--ink-2)]">Optional — got another 20 seconds? A public <b>Google</b> review helps a small provider most. (You&rsquo;re done either way.)</div>
              <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="mt-2.5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-extrabold text-[#1d3a8f] shadow-sm ring-1 ring-[#dbe3f4] transition hover:bg-[#f6f9ff]"><span style={{ color: "#ea4335" }}>★</span> Add a Google review ↗</a>
            </div>
          )}
          <div><button type="button" onClick={() => setSent(false)} className="mt-3 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-[12.5px] font-bold text-[var(--ink-2)]">Leave more feedback</button></div>
        </Card>
      ) : (
        <Card className="p-4 sm:p-5">
          <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Which provider</label>
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="mb-4 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13.5px] text-[var(--ink)]">
            <option value="">Choose…</option>
            {providers.map((p) => <option key={p.tenantId} value={p.tenantId}>{p.name}</option>)}
          </select>

          <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Your rating</label>
          <div className="flex items-center gap-1.5">
            {STARS.map((n) => (
              <button key={n} type="button" onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)} aria-label={`${n} star${n === 1 ? "" : "s"}`} className="text-[30px] leading-none transition-transform hover:scale-110" style={{ color: (hover || rating) >= n ? "#f5b301" : "#d9d5e4" }}>★</button>
            ))}
            <span className="ml-2 text-[12.5px] font-bold text-[var(--ink-2)]">{RATING_WORD[hover || rating]}</span>
          </div>

          <label className="mb-1 mt-4 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Which activity <span className="font-normal normal-case">— optional</span></label>
          <input value={listing} onChange={(e) => setListing(e.target.value)} placeholder="e.g. After-School Football Club" className="mb-4 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13.5px] text-[var(--ink)]" />

          <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Your comments <span className="font-normal normal-case">— optional</span></label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} placeholder="What went well? Anything they could do better?" className="w-full rounded-lg border border-[var(--line)] bg-white p-2.5 text-[13.5px] leading-[1.55] text-[var(--ink)] outline-none focus:border-[var(--brand,#2f6bd8)]" />

          {error && <div className="mt-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] font-semibold text-[#c0362c]">{error}</div>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" disabled={!valid || busy} onClick={submit} className="rounded-full bg-[#1d3a8f] px-5 py-2.5 text-[13.5px] font-extrabold text-white shadow-sm transition enabled:hover:brightness-110 disabled:opacity-45">{busy ? "Sending…" : "Send feedback"}</button>
            {!tenantId && <span className="text-[12px] text-[var(--ink-3)]">Choose a provider first.</span>}
            {tenantId && rating < 1 && <span className="text-[12px] text-[var(--ink-3)]">Tap a star to rate.</span>}
          </div>
        </Card>
      )}

      {mine.length > 0 && (
        <Card className="mt-3 p-0">
          <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 text-[11px] font-black uppercase tracking-wide text-[var(--ink-3)]">Feedback you've sent</div>
          <ul className="divide-y divide-[var(--line)]">
            {mine.map((f) => (
              <li key={f.id} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[14px]" style={{ color: "#f5b301" }}>{"★".repeat(f.rating)}<span className="text-[#d9d5e4]">{"★".repeat(5 - f.rating)}</span></span>
                  {f.listing && <span className="text-[12.5px] font-bold text-[var(--ink-2)]">{f.listing}</span>}
                  <span className="ml-auto text-[11px] text-[var(--ink-3)]">{fmt(f.createdAt)}</span>
                </div>
                {f.comment && <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--ink-2)]">{f.comment}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
