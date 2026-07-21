"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Badge, Button, Card, FieldLabel, Input } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Reconciliation — what money is owed and by which route, and marking it
// received when it lands. Card is auto (Stripe); TFC, vouchers, bank transfer
// and cash arrive off-platform, so the provider matches them here. Partial
// payments accumulate; overdue vouchers are flagged (never auto-cancelled).
// Simple by design — Kaz can restyle.
// ─────────────────────────────────────────────────────────────────────────

interface Item {
  ref: string;
  booker: string;
  listing: string;
  child: string;
  method: string;
  pay: string;
  amount: number;
  amountPaid: number;
  outstanding: number;
  voucherScheme: string | null;
  voucherReceiveBy: string | null;
  overdue: boolean;
}
interface Recon {
  items: Item[];
  summary: { count: number; outstanding: number; overdue: number; awaitingVoucher: number; byMethod: Record<string, { count: number; outstanding: number }> };
}

const fmt = (iso?: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "");

function RecordForm({ item, onDone }: { item: Item; onDone: () => void }) {
  const [amount, setAmount] = useState(String(item.outstanding));
  const [method, setMethod] = useState(item.voucherScheme ? `Voucher (${item.voucherScheme})` : item.method);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter an amount."); return; }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/bookings/${encodeURIComponent(item.ref)}/record-payment`, { method: "POST", body: JSON.stringify({ amount: amt, method, reference }) });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t record");
      setBusy(false);
    }
  }
  return (
    <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="mb-1.5 text-[12px] font-extrabold">Record money received for #{item.ref}</div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div><FieldLabel>Amount £</FieldLabel><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full" /></div>
        <div><FieldLabel>Method</FieldLabel><Input value={method} onChange={(e) => setMethod(e.target.value)} className="w-full" /></div>
        <div><FieldLabel>Reference</FieldLabel><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. bank ref" className="w-full" /></div>
      </div>
      {error && <div className="mt-1.5 text-[12px] font-bold text-[var(--red)]">{error}</div>}
      <div className="mt-2 flex gap-2"><Button sm variant="primary" disabled={busy} onClick={save}>{busy ? "Recording…" : "Confirm received"}</Button><Button sm onClick={onDone}>Cancel</Button></div>
    </div>
  );
}

export function ReconciliationApp() {
  const [recon, setRecon] = useState<Recon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openRef, setOpenRef] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<Recon>("/api/reconciliation").then((r) => { setRecon(r); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["bookings", "payments"], refresh);

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Reconciliation</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Money still to come in — card settles itself; vouchers, Tax-Free Childcare, bank transfers and cash you match here.</p>

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {recon && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="text-[15px] font-extrabold">{money(recon.summary.outstanding)} outstanding</span>
            <span className="text-[var(--ink-3)]">across {recon.summary.count} booking{recon.summary.count === 1 ? "" : "s"}</span>
            {recon.summary.overdue > 0 && <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" }}>⚠ {recon.summary.overdue} overdue</Badge>}
            {recon.summary.awaitingVoucher > 0 && <Badge tone={{ bg: "#e7f0ff", fg: "#1d3a8f" }}>{recon.summary.awaitingVoucher} awaiting voucher</Badge>}
          </div>
          {Object.keys(recon.summary.byMethod).length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {Object.entries(recon.summary.byMethod).map(([m, v]) => (
                <span key={m} className="rounded-full border border-[var(--line)] px-2.5 py-[3px] text-[11.5px] text-[var(--ink-2)]">{m}: <b>{money(v.outstanding)}</b> ({v.count})</span>
              ))}
            </div>
          )}
        </>
      )}

      {!recon ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : recon.items.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">Nothing outstanding — every booking is settled. 🎉</Card>
      ) : (
        <div className="flex flex-col gap-2">
          {recon.items.map((it) => (
            <Card key={it.ref} className="p-3.5" style={it.overdue ? { borderColor: "var(--red-line,#f6c9cc)" } : undefined}>
              <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <span className="font-extrabold">#{it.ref}</span>
                <span>{it.booker} · {it.child}</span>
                <span className="text-[var(--ink-3)]">{it.listing}</span>
                {it.voucherScheme && <Badge tone={{ bg: "#e7f0ff", fg: "#1d3a8f" }}>{it.voucherScheme}</Badge>}
                {it.overdue && <Badge tone={{ bg: "var(--red,#e21d27)", fg: "#fff" }}>overdue{it.voucherReceiveBy ? ` since ${fmt(it.voucherReceiveBy)}` : ""}</Badge>}
                <span className="ml-auto font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {money(it.outstanding)} due
                  {it.amountPaid > 0 && <span className="ml-1 text-[11px] font-normal text-[var(--ink-3)]">({money(it.amountPaid)} of {money(it.amount)} paid)</span>}
                </span>
              </div>
              <div className="mt-1.5">
                <Button sm variant="primary" onClick={() => setOpenRef(openRef === it.ref ? null : it.ref)}>Record payment</Button>
              </div>
              {openRef === it.ref && <RecordForm item={it} onDone={() => { setOpenRef(null); refresh(); }} />}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
