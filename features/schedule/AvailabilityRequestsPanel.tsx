"use client";

// Operator → "Availability requests": ask a specific team member to submit their
// availability for a window (next/this week, or their ongoing pattern). The staff
// member sees it on their My availability page and submits against it; the status
// here flips to Submitted. Real backend store: /api/availability/requests.
import { useEffect, useMemo, useState } from "react";
import { get, post, del } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";

interface ReqWindow { kind: "week" | "range" | "ongoing"; label: string; from?: string; to?: string }
interface AvailRequest { id: string; staffEmail: string; staffName?: string | null; window: ReqWindow; note?: string; status: "pending" | "submitted"; createdAt: string; submittedAt?: string }
interface Invite { token: string; role: string; sentTo?: string | null; usedBy?: string | null }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (s?: string) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");
function weekFrom(offset: number): ReqWindow {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  const mon = new Date(d); mon.setDate(d.getDate() - dow + offset * 7); mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const label = `week of ${mon.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`;
  return { kind: "week", label, from: iso(mon), to: iso(sun) };
}
const WINDOWS: [string, () => ReqWindow][] = [
  ["This week", () => weekFrom(0)],
  ["Next week", () => weekFrom(1)],
  ["The week after", () => weekFrom(2)],
  ["Ongoing (usual weekly pattern)", () => ({ kind: "ongoing", label: "your usual weekly pattern" })],
];

export function AvailabilityRequestsPanel() {
  const [rows, setRows] = useState<AvailRequest[]>([]);
  const [invited, setInvited] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [winIdx, setWinIdx] = useState(1); // default "Next week"
  const [note, setNote] = useState("We're building the rota — please add the days and hours you can work.");
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => get<AvailRequest[]>("/api/availability/requests").then(setRows).catch(() => {});
  useEffect(() => {
    void load();
    get<Invite[]>("/api/invites").then((xs) => setInvited([...new Set(xs.filter((x) => x.role === "staff" && x.sentTo).map((x) => x.sentTo as string))])).catch(() => {});
  }, []);

  const valid = /.+@.+\..+/.test(email.trim());
  const send = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const window = WINDOWS[winIdx][1]();
      await post("/api/availability/requests", { staffEmail: email.trim(), staffName: name.trim() || undefined, window, note: note.trim() || undefined });
      setFlash(`Requested from ${email.trim()} · ${window.label}.`);
      setEmail(""); setName("");
      await load();
      setTimeout(() => setFlash(null), 4000);
    } catch (e) { setFlash(e instanceof Error ? e.message : "Couldn't send the request"); }
    finally { setBusy(false); }
  };
  const withdraw = async (id: string) => { await del(`/api/availability/requests/${id}`).catch(() => {}); await load(); };

  const pending = useMemo(() => rows.filter((r) => r.status === "pending").length, [rows]);

  return (
    <div className="flex flex-col gap-3">
      <Card className="p-4">
        <div className="mb-1 text-[14px] font-extrabold text-[var(--ink)]">Request availability from a team member</div>
        <p className="mb-3 text-[12px] text-[var(--ink-3)]">They&rsquo;ll see it on their <b>My availability</b> page and submit for the dates you choose. The status below flips to <b>Submitted</b> when they&rsquo;re done.</p>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Staff email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="w-full" />
            {invited.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {invited.map((x) => <button key={x} type="button" onClick={() => setEmail(x)} className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-2)] hover:bg-[#eef4fd] hover:text-[#1d3a8f]">{x}</button>)}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Name <span className="font-normal normal-case">— optional</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kaz James" className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">For</label>
            <select value={winIdx} onChange={(e) => setWinIdx(Number(e.target.value))} className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13px] text-[var(--ink)]">
              {WINDOWS.map(([label], i) => <option key={label} value={i}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Note <span className="font-normal normal-case">— optional</span></label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="w-full" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={!valid || busy} onClick={send} className="!bg-[#1d3a8f] !border-[#1d3a8f] !text-white">{busy ? "Sending…" : "Send request"}</Button>
          {flash && <span className="text-[12.5px] font-semibold text-[#0f7a43]">✓ {flash}</span>}
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5">
          <span className="text-[11px] font-black uppercase tracking-wide text-[var(--ink-3)]">Requests</span>
          <span className="text-[12px] font-bold text-[var(--ink-3)]">{pending} awaiting · {rows.length} total</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">No requests yet — send one above.</div>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="text-[13px] font-extrabold text-[var(--ink)]">{r.staffName || r.staffEmail}</span>
                {r.staffName && <span className="text-[11.5px] text-[var(--ink-3)]">{r.staffEmail}</span>}
                <span className="text-[12px] text-[var(--ink-2)]">· {r.window.label}{r.window.from ? ` (${fmt(r.window.from)}–${fmt(r.window.to)})` : ""}</span>
                <span className="ml-auto flex items-center gap-2">
                  {r.status === "submitted"
                    ? <span className="rounded-full bg-[#e7f5ec] px-2.5 py-0.5 text-[11px] font-extrabold text-[#0f7a43]">✓ Submitted</span>
                    : <span className="rounded-full bg-[#fdf6e3] px-2.5 py-0.5 text-[11px] font-extrabold text-[#8a5a09]">Awaiting</span>}
                  <button type="button" onClick={() => withdraw(r.id)} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Withdraw</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
