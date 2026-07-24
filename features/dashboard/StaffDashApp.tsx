"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { get as apiGet, put as apiPut } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// staff/dash — the staff member's landing page. Everything on it is live
// server data scoped to their tenant: today's sessions (the same source
// registers and ratios read), the team's open tasks, and whether a day
// plan is published for today. Replaces the legacy prototype iframe.
// ─────────────────────────────────────────────────────────────────────────

interface RatioSession {
  blockId: string;
  start: string;
  end: string;
  blockName: string;
  listingName: string;
  totalChildren: number;
  sendCount: number;
  requiredStaff: number;
  staffAssigned: number;
  met: boolean;
}
interface Task { id: string; title: string; done: boolean; priority?: "low" | "normal" | "high"; dueDate?: string; assignee?: string }
interface PublishedLite { id: string; dayList: { iso: string }[] }
interface Me { tenantName: string | null }

const todayIso = () => {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
};

export function StaffDashApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [sessions, setSessions] = useState<RatioSession[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [timetableToday, setTimetableToday] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayIso();

  const refresh = useCallback(() => {
    apiGet<{ sessions: RatioSession[] }>(`/api/ratios?date=${today}`)
      .then((d) => setSessions(d.sessions))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load today"));
    apiGet<Task[]>("/api/tasks").then(setTasks).catch(() => {});
    apiGet<PublishedLite[]>("/api/timetables/published")
      .then((w) => setTimetableToday(w.some((x) => x.dayList.some((d) => d.iso === today))))
      .catch(() => {});
  }, [today]);
  useEffect(() => {
    apiGet<Me>("/api/me").then(setMe).catch(() => {});
    refresh();
  }, [refresh]);
  useRealtime(["bookings", "blocks", "tasks", "timetables"], refresh);

  const open = (tasks ?? []).filter((t) => !t.done);
  const kidsToday = (sessions ?? []).reduce((n, s) => n + s.totalChildren, 0);
  const tickTask = (t: Task) => {
    // Optimistic tick; realtime brings the server copy straight back.
    setTasks((list) => (list ?? []).map((x) => (x.id === t.id ? { ...x, done: true } : x)));
    void apiPut(`/api/tasks/${t.id}`, { done: true }).catch(() => refresh());
  };

  const dayLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-4">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          Today at {me?.tenantName ?? "your club"}
        </h2>
        <p className="text-[12.5px] text-[var(--ink-3)]">{dayLabel} — live from bookings, registers and the team’s tasks.</p>
      </div>

      {error && <div className="mb-3 text-[12.5px] font-bold text-[var(--red,#e21d27)]">{error}</div>}

      {/* Tiles */}
      <div className="mb-4 flex flex-wrap gap-2.5">
        {[
          { big: sessions === null ? "…" : String(sessions.length), small: "Sessions today" },
          { big: sessions === null ? "…" : String(kidsToday), small: "Children in" },
          { big: tasks === null ? "…" : String(open.length), small: "Open tasks" },
        ].map((t) => (
          <div key={t.small} className="min-w-[110px] flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3">
            <div className="text-[22px] font-extrabold leading-none text-[var(--brand)]" style={{ fontFamily: "var(--ff-display)" }}>{t.big}</div>
            <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t.small}</div>
          </div>
        ))}
      </div>

      {/* Today's sessions */}
      <Card className="mb-3 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-extrabold">Today&rsquo;s sessions</span>
          <span className="flex gap-2">
            {timetableToday && (
              <Link href="/staff/timetable"><Button sm>Day plan</Button></Link>
            )}
            <Link href="/staff/registers"><Button sm variant="primary">Open registers</Button></Link>
          </span>
        </div>
        {sessions === null ? (
          <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">Nothing runs today.</div>
        ) : (
          sessions.map((s) => (
            <div key={s.blockId} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-dashed border-[var(--line)] py-2 last:border-b-0">
              <span className="text-[12px] font-bold text-[var(--ink-3)]">{s.start}–{s.end}</span>
              <span className="text-[13px] font-extrabold">{s.listingName}</span>
              <span className="text-[12px] text-[var(--ink-3)]">{s.blockName}</span>
              <span className="ml-auto flex items-center gap-1.5 text-[11.5px]">
                <Badge tone={{ bg: "var(--brand-soft)", fg: "var(--brand-strong)" }}>{s.totalChildren} children</Badge>
                {s.sendCount > 0 && <Badge tone={{ bg: "#f3e8ff", fg: "#7c3aed" }}>{s.sendCount} SEND</Badge>}
                <Badge tone={s.met ? { bg: "var(--green-soft,#e7f8ee)", fg: "#0f7a44" } : { bg: "#fdf3d8", fg: "#9a5a00" }}>
                  {s.staffAssigned}/{s.requiredStaff} staff
                </Badge>
              </span>
            </div>
          ))
        )}
      </Card>

      {/* Open tasks */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-extrabold">Team tasks</span>
          <Link href="/staff/tasks"><Button sm>All tasks</Button></Link>
        </div>
        {tasks === null ? (
          <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
        ) : open.length === 0 ? (
          <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">All done — nothing open.</div>
        ) : (
          open.slice(0, 6).map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 border-b border-dashed border-[var(--line)] py-1.5 last:border-b-0">
              <button
                type="button"
                onClick={() => tickTask(t)}
                aria-label={`Mark "${t.title}" done`}
                className="h-[18px] w-[18px] flex-none cursor-pointer rounded-md border-[1.5px] border-[var(--line)] hover:border-[var(--brand)]"
              />
              <span className="min-w-0 flex-1 truncate text-[12.5px]">{t.title}</span>
              {t.priority === "high" && <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "#bb1620" }}>high</Badge>}
              {t.dueDate && <span className="text-[11px] text-[var(--ink-3)]">{t.dueDate}</span>}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
