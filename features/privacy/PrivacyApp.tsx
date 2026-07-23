"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { Button, Card } from "@/components/ui";

interface Payload { role: string; summary: Record<string, number> }
const LABELS: Record<string, string> = { children: "Children", bookings: "Bookings", mealOrders: "Meal orders", medications: "Medications", moments: "Photos of your child" };

export function PrivacyApp() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiGet<Payload>("/api/privacy").then((d) => { setData(d); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function download() {
    setBusy(true); setError(null);
    try {
      const blob = await apiGet<Record<string, unknown>>("/api/privacy/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(blob, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = `my-activityos-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t export"); }
    finally { setBusy(false); }
  }

  async function requestDeletion() {
    if (!confirm("Request deletion of your account and personal data? A member of the team will action this — some records providers are legally required to keep may be retained.")) return;
    setError(null); setOk(null);
    try { const r = await apiPost<{ alreadyRequested?: boolean }>("/api/privacy/delete-request", {}); setOk(r.alreadyRequested ? "You’ve already got a deletion request on file — we’re on it." : "Deletion requested. We’ll be in touch to confirm."); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t submit"); }
  }

  const entries = data ? Object.entries(data.summary).filter(([, n]) => n > 0) : [];

  return (
    <div className="max-w-[640px] text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Data &amp; privacy</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">See what we hold about you, download it, or ask us to delete it.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--green-soft,#e7f8ee)] px-3 py-2 text-[12.5px] text-[#0f7a44]">{ok}</div>}

      <Card className="mb-3 p-4">
        <div className="mb-2 text-[13.5px] font-extrabold">What we hold</div>
        {!data ? <div className="text-[12.5px] text-[var(--ink-3)]">Loading…</div>
          : entries.length === 0 ? <div className="text-[12.5px] text-[var(--ink-3)]">Just your account details.</div>
          : (
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px]">
              {entries.map(([k, n]) => <span key={k}><span className="text-[var(--ink-3)]">{LABELS[k] ?? k}: </span><span className="font-bold">{n}</span></span>)}
            </div>
          )}
      </Card>

      <Card className="mb-3 p-4">
        <div className="mb-1 text-[13.5px] font-extrabold">Download your data</div>
        <p className="mb-2.5 text-[12px] text-[var(--ink-3)]">A machine-readable (JSON) copy of everything above.</p>
        <Button variant="primary" onClick={download} disabled={busy}>{busy ? "Preparing…" : "Download my data"}</Button>
      </Card>

      <Card className="p-4">
        <div className="mb-1 text-[13.5px] font-extrabold">Delete your account</div>
        <p className="mb-2.5 text-[12px] text-[var(--ink-3)]">We’ll remove your account and personal data. Some records a provider is legally required to keep (e.g. safeguarding) may be retained for the required period.</p>
        <Button variant="danger" onClick={requestDeletion}>Request deletion</Button>
      </Card>
    </div>
  );
}
