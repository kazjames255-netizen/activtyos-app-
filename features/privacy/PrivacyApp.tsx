"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useI18n } from "@/lib/i18n/provider";
import { Button, Card } from "@/components/ui";

interface Payload { role: string; summary: Record<string, number> }
// The load callback keeps its [] deps (the i18n `t` changes every render), so a
// non-Error rejection stores this marker and the render swaps in the translation.
const LOAD_FAILED = "Failed to load";

export function PrivacyApp() {
  const { t } = useI18n();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const LABELS: Record<string, string> = { children: t("account.lblChildren"), bookings: t("account.lblBookings"), mealOrders: t("account.lblMealOrders"), medications: t("account.lblMedications"), moments: t("account.lblMoments") };

  const load = useCallback(() => {
    apiGet<Payload>("/api/privacy").then((d) => { setData(d); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : LOAD_FAILED));
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
    } catch (e) { setError(e instanceof Error ? e.message : t("account.exportErr")); }
    finally { setBusy(false); }
  }

  async function requestDeletion() {
    if (!confirm(t("account.deleteConfirm"))) return;
    setError(null); setOk(null);
    try { const r = await apiPost<{ alreadyRequested?: boolean }>("/api/privacy/delete-request", {}); setOk(r.alreadyRequested ? t("account.deleteAlready") : t("account.deleteRequested")); }
    catch (e) { setError(e instanceof Error ? e.message : t("account.submitErr")); }
  }

  const entries = data ? Object.entries(data.summary).filter(([, n]) => n > 0) : [];

  return (
    <div className="max-w-[640px] text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("account.privTitle")}</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">{t("account.privLede")}</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error === LOAD_FAILED ? t("account.failedLoad") : error}</div>}
      {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12.5px] text-[#1d3a8f]">{ok}</div>}

      <Card className="mb-3 p-4">
        <div className="mb-2 text-[13.5px] font-extrabold">{t("account.privHold")}</div>
        {!data ? <div className="text-[12.5px] text-[var(--ink-3)]">{t("account.loading")}</div>
          : entries.length === 0 ? <div className="text-[12.5px] text-[var(--ink-3)]">{t("account.privJustAccount")}</div>
          : (
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px]">
              {entries.map(([k, n]) => <span key={k}><span className="text-[var(--ink-3)]">{LABELS[k] ?? k}: </span><span className="font-bold">{n}</span></span>)}
            </div>
          )}
      </Card>

      <Card className="mb-3 p-4">
        <div className="mb-1 text-[13.5px] font-extrabold">{t("account.privDownloadTitle")}</div>
        <p className="mb-2.5 text-[12px] text-[var(--ink-3)]">{t("account.privDownloadLede")}</p>
        <Button variant="primary" onClick={download} disabled={busy}>{busy ? t("account.preparing") : t("account.downloadMyData")}</Button>
      </Card>

      <Card className="p-4">
        <div className="mb-1 text-[13.5px] font-extrabold">{t("account.privDeleteTitle")}</div>
        <p className="mb-2.5 text-[12px] text-[var(--ink-3)]">{t("account.privDeleteLede")}</p>
        <Button variant="danger" onClick={requestDeletion}>{t("account.requestDeletion")}</Button>
      </Card>
    </div>
  );
}
