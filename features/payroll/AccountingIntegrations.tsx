"use client";

import { useEffect, useState } from "react";
import { get, post, put, ApiError } from "@/lib/api";
import { Button, Card, Select } from "@/components/ui";
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

const BUCKET_ORDER = ["grossWages", "employerNi", "employerPension", "payeNicLiability", "pensionPayable", "netWagesBank", "otherDeductions"];

function ProviderCard({ provider, name, status, onChange }: { provider: Provider; name: string; status: ConnStatus; onChange: () => void }) {
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
      get<Account[]>(`/api/accounting/${provider}/accounts`).catch((e) => { setErr(e instanceof ApiError ? e.message : "Couldn't load the chart of accounts"); return []; }),
    ]).then(([m, a]) => {
      if (!live) return;
      setBuckets([...m.buckets].sort((x, y) => BUCKET_ORDER.indexOf(x.key) - BUCKET_ORDER.indexOf(y.key)));
      setMapping(m.mapping || {});
      setAccounts(a);
    }).finally(() => live && setLoadingMap(false));
    return () => { live = false; };
  }, [status.connected, provider]);

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
      setErr(e instanceof ApiError ? e.message : "Couldn't start the connection");
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (!confirm(`Disconnect ${name}? Existing journal entries in ${name} are unaffected.`)) return;
    setDisconnecting(true);
    try { await post(`/api/accounting/${provider}/disconnect`, {}); onChange(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Couldn't disconnect"); }
    finally { setDisconnecting(false); }
  }

  async function saveMapping() {
    setSaving(true); setErr("");
    try { await put("/api/accounting/mapping", { provider, mapping }); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Couldn't save the mapping"); }
    finally { setSaving(false); }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <div className="text-[14px] font-extrabold text-[var(--ink)]">{name}</div>
          <div className="text-[12px] text-[var(--ink-3)]">
            {!status.configured ? "Not configured on this server" : status.connected ? (status.needsReconnect ? "Needs reconnecting: the saved sign-in expired or was revoked" : `Connected${status.label ? ` · ${status.label}` : ""}`) : "Not connected"}
          </div>
        </div>
        {status.configured && (
          status.connected
            ? <Button variant="danger" sm onClick={disconnect} disabled={disconnecting}>{disconnecting ? "Disconnecting…" : "Disconnect"}</Button>
            : <Button variant="primary" sm onClick={connect} disabled={connecting}>{connecting ? "Connecting…" : "Connect"}</Button>
        )}
      </div>

      {err && <div className="mt-2 rounded-lg bg-[#fdecea] px-3 py-2 text-[12px] font-semibold text-[#a3241c]">{err}</div>}

      {status.connected && (
        <div className="mt-3 border-t border-[var(--line)] pt-3">
          <SectionHead>Account mapping</SectionHead>
          {loadingMap ? (
            <div className="text-[12px] text-[var(--ink-3)]">Loading chart of accounts…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {buckets.map((b) => (
                  <div key={b.key}>
                    <FieldLabel htmlFor={`${provider}-${b.key}`}>{b.label}</FieldLabel>
                    <Select
                      id={`${provider}-${b.key}`}
                      className="w-full"
                      value={mapping[b.key] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [b.key]: e.target.value }))}
                    >
                      <option value="">Choose an account…</option>
                      {(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Button variant="primary" sm onClick={saveMapping} disabled={saving}>{saving ? "Saving…" : "Save mapping"}</Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

export function AccountingIntegrations() {
  const [status, setStatus] = useState<Record<Provider, ConnStatus> | null>(null);
  const [err, setErr] = useState("");

  const load = () => {
    get<Record<Provider, ConnStatus>>("/api/accounting/connections")
      .then(setStatus)
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Couldn't load accounting connections"));
  };
  useEffect(load, []);

  return (
    <div className="mx-auto max-w-[760px] p-4">
      <div className="mb-1 text-[15px] font-extrabold text-[var(--ink)]">Accounting integrations</div>
      <div className="mb-3 text-[12.5px] text-[var(--ink-3)]">
        Connect QuickBooks, Xero or Sage to post each approved pay run&apos;s wages journal automatically. The CSV export on the Payroll
        screen always works without connecting anything.
      </div>
      {err && <div className="mb-3 rounded-lg bg-[#fdecea] px-3 py-2 text-[12px] font-semibold text-[#a3241c]">{err}</div>}
      {!status ? (
        <div className="text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : (
        <div className="flex flex-col gap-3">
          {PROVIDERS.map((p) => <ProviderCard key={p.id} provider={p.id} name={p.name} status={status[p.id]} onChange={load} />)}
        </div>
      )}
    </div>
  );
}
