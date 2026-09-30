"use client";

import { useEffect, useState } from "react";
import { get, post, put, ApiError } from "@/lib/api";
import { Button, Card, Select } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { SectionHead, FieldLabel } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Accounting integrations — connect QuickBooks Online / Xero / Sage Business
// Cloud Accounting and map the 6 wages-journal account buckets, per
// docs/payroll-integrations-handoff.md §3. Posting a run's journal itself
// happens from the Payroll screen (POST /api/accounting/post/:runId); this
// screen only handles connecting and mapping.
//
// Rendered by the Integrations tab of PayrollApp (live accounts; demo mode keeps its
// local mock cards). Posting happens from the Payslips tab of the same screen.
//
// Every value here is safe to show the browser: connection status, provider
// labels, chart-of-accounts entries and the 6 mapped codes. No token, secret
// or refresh token is ever part of any response this screen reads.
// ─────────────────────────────────────────────────────────────────────────

type Provider = "quickbooks" | "xero" | "sage";
const PROVIDERS: { id: Provider; name: string }[] = [
  { id: "quickbooks", name: "QuickBooks Online" },
  { id: "xero", name: "Xero" },
  { id: "sage", name: "Sage Business Cloud Accounting" },
];

type ConnStatus = { configured: boolean; connected: boolean; connectedAt?: string | null; label?: string | null; needsReconnect?: boolean };
type Bucket = { key: string; label: string };
type Account = { id: string; name: string };

const BUCKET_KEY: Record<string, string> = { grossWages: "acBktGrossWages", employerNi: "acBktEmployerNi", employerPension: "acBktEmployerPension", payeNicLiability: "acBktPayeNic", pensionPayable: "acBktPensionPayable", netWagesBank: "acBktNetWages", otherDeductions: "acBktOther" };
const BUCKET_ORDER = ["grossWages", "employerNi", "employerPension", "payeNicLiability", "pensionPayable", "netWagesBank", "otherDeductions"];

function ProviderCard({ provider, name, status, onChange }: { provider: Provider; name: string; status: ConnStatus; onChange: () => void }) {
  const t = useT();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loadingMap, setLoadingMap] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!status.connected) return;
    let live = true;
    setLoadingMap(true);
    Promise.all([
      get<{ buckets: Bucket[]; mapping: Record<string, string> }>(`/api/accounting/mapping?provider=${provider}`),
      get<Account[]>(`/api/accounting/${provider}/accounts`).catch((e) => { setErr(e instanceof ApiError ? e.message : t("p8wf.acLoadAccountsErr")); return []; }),
    ]).then(([m, a]) => {
      if (!live) return;
      setBuckets([...m.buckets].sort((x, y) => BUCKET_ORDER.indexOf(x.key) - BUCKET_ORDER.indexOf(y.key)));
      setMapping(m.mapping || {});
      setAccounts(a);
    }).finally(() => live && setLoadingMap(false));
    return () => { live = false; };
  }, [status.connected, provider, t]);

  async function connect() {
    setErr(""); setConnecting(true);
    try {
      const { url } = await get<{ url: string }>(`/api/accounting/${provider}/connect`);
      const w = window.open(url, "aos-accounting-connect", "width=520,height=700");
      const onMsg = (ev: MessageEvent) => {
        if (ev?.data?.source !== "aos-accounting") return;
        window.removeEventListener("message", onMsg);
        setConnecting(false);
        onChange();
      };
      window.addEventListener("message", onMsg);
      // The popup can also just be closed by hand — poll for that so the
      // button doesn't sit on "Connecting…" forever.
      const poll = setInterval(() => {
        if (!w || w.closed) { clearInterval(poll); window.removeEventListener("message", onMsg); setConnecting(false); onChange(); }
      }, 800);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("p8wf.acStartErr"));
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (!confirm(t("p8wf.acConfirmDisconnect", { name }))) return;
    setDisconnecting(true);
    try { await post(`/api/accounting/${provider}/disconnect`, {}); onChange(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : t("p8wf.acDisconnectErr")); }
    finally { setDisconnecting(false); }
  }

  async function saveMapping() {
    setSaving(true); setErr("");
    try { await put("/api/accounting/mapping", { provider, mapping }); }
    catch (e) { setErr(e instanceof ApiError ? e.message : t("p8wf.acSaveMapErr")); }
    finally { setSaving(false); }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <div className="text-[14px] font-extrabold text-[var(--ink)]">{name}</div>
          <div className="text-[12px] text-[var(--ink-3)]">
            {!status.configured ? t("p8wf.acNotConfigured") : status.connected ? (status.needsReconnect ? t("p8wf.acNeedsReconnect") : status.label ? t("p8wf.acConnectedLabel", { label: status.label }) : t("p8wf.acConnected")) : t("p8wf.acNotConnected")}
          </div>
        </div>
        {status.configured && (
          status.connected
            ? <Button variant="danger" sm onClick={disconnect} disabled={disconnecting}>{disconnecting ? t("p8wf.acDisconnecting") : t("p8wf.prDisconnect")}</Button>
            : <Button variant="primary" sm onClick={connect} disabled={connecting}>{connecting ? t("p8wf.acConnecting") : t("p8wf.acConnect")}</Button>
        )}
      </div>

      {err && <div className="mt-2 rounded-lg bg-[#fdecea] px-3 py-2 text-[12px] font-semibold text-[#a3241c]">{err}</div>}

      {status.connected && (
        <div className="mt-3 border-t border-[var(--line)] pt-3">
          <SectionHead>{t("p8wf.acMapping")}</SectionHead>
          {loadingMap ? (
            <div className="text-[12px] text-[var(--ink-3)]">{t("p8wf.acLoadingChart")}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {buckets.map((b) => (
                  <div key={b.key}>
                    <FieldLabel htmlFor={`${provider}-${b.key}`}>{BUCKET_KEY[b.key] ? t("p8wf." + BUCKET_KEY[b.key]) : b.label}</FieldLabel>
                    <Select
                      id={`${provider}-${b.key}`}
                      className="w-full"
                      value={mapping[b.key] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [b.key]: e.target.value }))}
                    >
                      <option value="">{t("p8wf.acChooseAccount")}</option>
                      {(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Button variant="primary" sm onClick={saveMapping} disabled={saving}>{saving ? t("p8wf.acSaving") : t("p8wf.acSaveMapping")}</Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

export function AccountingIntegrations() {
  const t = useT();
  const [status, setStatus] = useState<Record<Provider, ConnStatus> | null>(null);
  const [err, setErr] = useState("");

  const load = () => {
    get<Record<Provider, ConnStatus>>("/api/accounting/connections")
      .then(setStatus)
      .catch((e) => setErr(e instanceof ApiError ? e.message : t("p8wf.acLoadConnErr")));
  };
  useEffect(load, []);

  return (
    <div className="mx-auto max-w-[760px] p-4">
      <div className="mb-1 text-[15px] font-extrabold text-[var(--ink)]">{t("p8wf.acTitle")}</div>
      <div className="mb-3 text-[12.5px] text-[var(--ink-3)]">{t("p8wf.acIntro")}</div>
      {err && <div className="mb-3 rounded-lg bg-[#fdecea] px-3 py-2 text-[12px] font-semibold text-[#a3241c]">{err}</div>}
      {!status ? (
        <div className="text-[12.5px] text-[var(--ink-3)]">{t("p8wf.acLoading")}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {PROVIDERS.map((p) => <ProviderCard key={p.id} provider={p.id} name={p.name} status={status[p.id]} onChange={load} />)}
        </div>
      )}
    </div>
  );
}
