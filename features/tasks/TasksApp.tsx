"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card, Input, Select } from "@/components/ui";

interface Task {
  id: string;
  title: string;
  notes?: string;
  done: boolean;
  assignee?: string;
  dueDate?: string;
  priority: "low" | "normal" | "high";
  createdByName?: string;
}

const prioTone: Record<string, { bg: string; fg: string }> = {
  high: { bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" },
  normal: { bg: "var(--panel)", fg: "var(--ink-2)" },
  low: { bg: "var(--panel)", fg: "var(--ink-3)" },
};
const fmt = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "");

export function TasksApp() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [canManage, setCanManage] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Task[]>("/api/tasks").then((t) => { setTasks(t); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["tasks"], refresh);

  async function add() {
    if (!title.trim()) return;
    try { await apiPost("/api/tasks", { title, assignee, dueDate: dueDate || undefined, priority }); setTitle(""); setAssignee(""); setDueDate(""); setPriority("normal"); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t add"); }
  }
  async function toggle(t: Task) {
    try { await api(`/api/tasks/${encodeURIComponent(t.id)}`, { method: "PUT", body: JSON.stringify({ done: !t.done }) }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  async function remove(t: Task) {
    try { await api(`/api/tasks/${encodeURIComponent(t.id)}`, { method: "DELETE" }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  const open = (tasks ?? []).filter((t) => !t.done);
  const done = (tasks ?? []).filter((t) => t.done);

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Tasks</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">The team’s shared to-do list.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Add a task…" className="min-w-[200px] flex-1" />
          <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Who" className="w-[110px]" />
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-[140px]" />
          <Select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="w-[110px]"><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></Select>
          <Button variant="primary" onClick={add}>Add</Button>
        </div>
      </Card>

      {!tasks ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : tasks.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No tasks — add the first above.</Card>
      ) : (
        <div className="flex flex-col gap-1.5">
          {open.map((t) => <Row key={t.id} t={t} onToggle={toggle} onRemove={remove} canManage={canManage} />)}
          {done.length > 0 && <div className="mt-3 mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Done ({done.length})</div>}
          {done.map((t) => <Row key={t.id} t={t} onToggle={toggle} onRemove={remove} canManage={canManage} />)}
        </div>
      )}
    </div>
  );

  function Row({ t, onToggle, onRemove, canManage }: { t: Task; onToggle: (t: Task) => void; onRemove: (t: Task) => void; canManage: boolean }) {
    return (
      <Card className="flex flex-wrap items-center gap-2 p-2.5">
        <input type="checkbox" checked={t.done} onChange={() => onToggle(t)} className="h-4 w-4" />
        <span className={`min-w-0 flex-1 text-[13px] ${t.done ? "text-[var(--ink-3)] line-through" : "font-bold"}`}>{t.title}</span>
        {!t.done && t.priority !== "normal" && <Badge tone={prioTone[t.priority]}>{t.priority}</Badge>}
        {t.assignee && <span className="text-[11.5px] text-[var(--ink-3)]">{t.assignee}</span>}
        {t.dueDate && <span className="text-[11.5px] text-[var(--ink-3)]">due {fmt(t.dueDate)}</span>}
        {canManage && <button type="button" onClick={() => onRemove(t)} className="text-[var(--ink-3)] hover:text-[var(--red)]" aria-label="Delete">×</button>}
      </Card>
    );
  }
}
