"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card, FieldLabel, Input, Select } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Incidents & Accidents — the safeguarding log. One component, `kind` picks
// the flavour (the fields, wording and slug differ; the record and API are
// shared). Staff can record; operators can edit or delete. Deliberately
// simple — Kaz can restyle; the record and its access rules are the point.
// ─────────────────────────────────────────────────────────────────────────

type Kind = "accident" | "incident";

interface Log {
  id: string;
  kind: Kind;
  date: string;
  time?: string;
  childName: string;
  childId?: string;
  location?: string;
  description: string;
  bodyPart?: string;
  injury?: string;
  treatment?: string;
  firstAider?: string;
  incidentType?: string;
  actionTaken?: string;
  witnesses?: string;
  severity: "minor" | "moderate" | "serious";
  parentNotified: boolean;
  parentNotifiedAt?: string;
  parentNotifiedHow?: string;
  followUp?: string;
  recordedByName?: string;
  createdAt?: string;
}

const COPY = {
  accident: { title: "Accidents", one: "accident", add: "Log an accident" },
  incident: { title: "Incidents", one: "incident", add: "Log an incident" },
} as const;

const sevTone: Record<string, { bg: string; fg: string }> = {
  minor: { bg: "var(--panel)", fg: "var(--ink-2)" },
  moderate: { bg: "#fdf3d8", fg: "#9a5a00" },
  serious: { bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" },
};
const todayIso = () => {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
};
const fmtDate = (iso: string) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "";

type Draft = Partial<Log> & { kind: Kind; date: string; childName: string; description: string };
const emptyDraft = (kind: Kind): Draft => ({ kind, date: todayIso(), time: "", childName: "", description: "", severity: "minor", parentNotified: false });

function LogForm({ kind, onSaved, onCancel }: { kind: Kind; onSaved: () => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(emptyDraft(kind));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));

  async function save() {
    if (!d.childName.trim() || !d.description.trim()) {
      setError("Add the child's name and what happened.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/incidents", d);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save");
      setBusy(false);
    }
  }

  return (
    <Card className="mb-3.5 p-4">
      <div className="mb-2 text-[13.5px] font-extrabold">{COPY[kind].add}</div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <div><FieldLabel>Child</FieldLabel><Input value={d.childName} onChange={(e) => set({ childName: e.target.value })} className="w-full" /></div>
        <div><FieldLabel>Date</FieldLabel><Input type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} className="w-full" /></div>
        <div><FieldLabel>Time</FieldLabel><Input type="time" value={d.time ?? ""} onChange={(e) => set({ time: e.target.value })} className="w-full" /></div>
        <div className="sm:col-span-2"><FieldLabel>Where</FieldLabel><Input value={d.location ?? ""} onChange={(e) => set({ location: e.target.value })} placeholder="e.g. the main hall" className="w-full" /></div>
        <div>
          <FieldLabel>Severity</FieldLabel>
          <Select value={d.severity} onChange={(e) => set({ severity: e.target.value as Draft["severity"] })} className="w-full">
            <option value="minor">Minor</option><option value="moderate">Moderate</option><option value="serious">Serious</option>
          </Select>
        </div>
      </div>
      <div className="mt-2.5"><FieldLabel>What happened</FieldLabel>
        <textarea value={d.description} onChange={(e) => set({ description: e.target.value })} rows={3} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] text-[var(--ink)]" />
      </div>
      {kind === "accident" ? (
        <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
          <div><FieldLabel>Injury / body part</FieldLabel><Input value={d.injury ?? ""} onChange={(e) => set({ injury: e.target.value })} placeholder="e.g. grazed left knee" className="w-full" /></div>
          <div><FieldLabel>First aider</FieldLabel><Input value={d.firstAider ?? ""} onChange={(e) => set({ firstAider: e.target.value })} className="w-full" /></div>
          <div className="sm:col-span-2"><FieldLabel>Treatment given</FieldLabel><Input value={d.treatment ?? ""} onChange={(e) => set({ treatment: e.target.value })} placeholder="e.g. cleaned and plaster applied" className="w-full" /></div>
        </div>
      ) : (
        <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
          <div><FieldLabel>Type</FieldLabel><Input value={d.incidentType ?? ""} onChange={(e) => set({ incidentType: e.target.value })} placeholder="e.g. behaviour, near-miss" className="w-full" /></div>
          <div><FieldLabel>Witnesses</FieldLabel><Input value={d.witnesses ?? ""} onChange={(e) => set({ witnesses: e.target.value })} className="w-full" /></div>
          <div className="sm:col-span-2"><FieldLabel>Action taken</FieldLabel><Input value={d.actionTaken ?? ""} onChange={(e) => set({ actionTaken: e.target.value })} className="w-full" /></div>
        </div>
      )}
      <label className="mt-2.5 flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={!!d.parentNotified} onChange={(e) => set({ parentNotified: e.target.checked, parentNotifiedAt: e.target.checked ? new Date().toISOString() : undefined })} />
        Parent / carer has been informed
      </label>
      {error && <div className="mt-2 text-[12.5px] font-bold text-[var(--red)]">{error}</div>}
      <div className="mt-3 flex gap-2">
        <Button variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save record"}</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

export function IncidentsApp({ kind }: { kind: Kind }) {
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Log[]>(`/api/incidents?kind=${kind}`)
      .then((l) => { setLogs(l); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [kind]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {});
  }, []);
  useRealtime(["incidents"], refresh);

  async function remove(l: Log) {
    if (!confirm(`Delete this ${COPY[kind].one} record for ${l.childName}? Safeguarding records are usually kept.`)) return;
    try { await api(`/api/incidents/${encodeURIComponent(l.id)}`, { method: "DELETE" }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  }

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{COPY[kind].title}</h2>
        {!adding && <Button variant="primary" onClick={() => setAdding(true)}>＋ {COPY[kind].add}</Button>}
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">The safeguarding log — recorded on the day, kept for your records.</p>

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {adding && <LogForm kind={kind} onSaved={() => { setAdding(false); refresh(); }} onCancel={() => setAdding(false)} />}

      {!logs ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : logs.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No {COPY[kind].one} records — hopefully it stays that way.</Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {logs.map((l) => (
            <Card key={l.id} className="p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-extrabold">{l.childName}</span>
                <Badge tone={sevTone[l.severity] ?? sevTone.minor}>{l.severity}</Badge>
                {l.parentNotified ? (
                  <Badge tone={{ bg: "#eaf0fc", fg: "#1d3a8f" }}>parent informed</Badge>
                ) : (
                  <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>parent not yet informed</Badge>
                )}
                <span className="ml-auto text-[11.5px] text-[var(--ink-3)]">{fmtDate(l.date)}{l.time ? ` · ${l.time}` : ""}</span>
              </div>
              <div className="mt-1 text-[12.5px] text-[var(--ink-2)]">{l.description}</div>
              <div className="mt-1.5 flex gap-2">
                <Button sm onClick={() => setOpenId(openId === l.id ? null : l.id)}>{openId === l.id ? "Hide" : "Details"}</Button>
                {canManage && <Button sm variant="danger" onClick={() => remove(l)}>Delete</Button>}
              </div>
              {openId === l.id && (
                <div className="mt-2 grid gap-x-6 gap-y-1 border-t border-[var(--line)] pt-2 text-[12px] sm:grid-cols-2">
                  {l.location && <div><span className="text-[var(--ink-3)]">Where: </span>{l.location}</div>}
                  {l.injury && <div><span className="text-[var(--ink-3)]">Injury: </span>{l.injury}</div>}
                  {l.treatment && <div><span className="text-[var(--ink-3)]">Treatment: </span>{l.treatment}</div>}
                  {l.firstAider && <div><span className="text-[var(--ink-3)]">First aider: </span>{l.firstAider}</div>}
                  {l.incidentType && <div><span className="text-[var(--ink-3)]">Type: </span>{l.incidentType}</div>}
                  {l.actionTaken && <div><span className="text-[var(--ink-3)]">Action: </span>{l.actionTaken}</div>}
                  {l.witnesses && <div><span className="text-[var(--ink-3)]">Witnesses: </span>{l.witnesses}</div>}
                  {l.parentNotifiedAt && <div><span className="text-[var(--ink-3)]">Parent informed: </span>{new Date(l.parentNotifiedAt).toLocaleString("en-GB")}</div>}
                  {l.recordedByName && <div><span className="text-[var(--ink-3)]">Recorded by: </span>{l.recordedByName}</div>}
                  {l.followUp && <div className="sm:col-span-2"><span className="text-[var(--ink-3)]">Follow-up: </span>{l.followUp}</div>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
