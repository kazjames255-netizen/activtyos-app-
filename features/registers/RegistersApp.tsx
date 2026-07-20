"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Registers — run the day on the ground. One card per session running on
// the chosen date; each expected child gets In / Out / Absent actions.
// This is the staff role's one write (operators can mark too); everything
// else on their portal is read-only. Live: another device marking a child
// in shows here instantly via the `registers` realtime collection.
// ─────────────────────────────────────────────────────────────────────────

interface Attendance {
  status: "in" | "out" | "absent";
  inAt: string | null;
  outAt: string | null;
  by: string;
}
interface SafeguardingRecord {
  photo?: string;
  allergies?: string;
  medical?: string;
  send?: string;
  sendPlanName?: string;
  collectionPassword?: string;
}
interface Attendee {
  ref: string;
  booker: string;
  bookingStatus: string;
  seats: number;
  children: { name: string; age?: number }[];
  child: SafeguardingRecord | null;
  attendance: Attendance | null;
}
interface Session {
  blockId: string;
  date: string;
  start: string;
  end: string;
  blockName: string;
  listingId: string;
  listingName: string;
  attendees: Attendee[];
  counts: { expected: number; in: number; out: number; absent: number };
}

const todayIso = () => {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
};
const shiftDay = (iso: string, by: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
const timeOf = (ts: string | null) =>
  ts ? new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

function AttendeeRow({
  a,
  onMark,
  busy,
}: {
  a: Attendee;
  onMark: (ref: string, status: "in" | "out" | "absent" | "expected") => void;
  busy: boolean;
}) {
  const st = a.attendance?.status ?? "expected";
  const tone =
    st === "in"
      ? { background: "var(--green-soft,#e7f8ee)", color: "#0f7a44" }
      : st === "out"
        ? { background: "var(--panel)", color: "var(--ink-3)" }
        : st === "absent"
          ? { background: "var(--red-soft,#fdebec)", color: "var(--red,#e21d27)" }
          : { background: "var(--panel)", color: "var(--ink-3)" };
  const label =
    st === "in"
      ? `In · ${timeOf(a.attendance!.inAt)}`
      : st === "out"
        ? `Out · ${timeOf(a.attendance!.outAt)}${a.attendance?.inAt ? ` (in ${timeOf(a.attendance.inAt)})` : ""}`
        : st === "absent"
          ? "Absent"
          : "Expected";
  const sg = a.child;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] py-2 first:border-t-0">
      {sg?.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sg.photo} alt="" className="h-9 w-9 flex-none rounded-full object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold">
          {a.children.map((c) => `${c.name}${c.age !== undefined ? ` (${c.age})` : ""}`).join(", ")}
        </div>
        <div className="truncate text-[11.5px] text-[var(--ink-3)]">
          {a.booker} · #{a.ref}
        </div>
        {sg && (sg.allergies || sg.send || sg.collectionPassword) && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {sg.allergies && (
              <span className="rounded px-1.5 py-[1px] text-[10.5px] font-bold" style={{ background: "var(--red-soft,#fdebec)", color: "var(--red,#e21d27)" }} title="Allergies">
                ⚠ {sg.allergies}
              </span>
            )}
            {(sg.send || sg.sendPlanName) && (
              <span className="rounded px-1.5 py-[1px] text-[10.5px] font-bold" style={{ background: "var(--brand-soft,#e7f0ff)", color: "var(--brand-ink,#1d3a8f)" }} title="SEND">
                SEND{sg.sendPlanName ? " · plan on file" : ""}
              </span>
            )}
            {sg.collectionPassword && (
              <span className="rounded px-1.5 py-[1px] text-[10.5px] font-bold" style={{ background: "#fdf3d8", color: "#9a5a00" }} title="Collection password — ask before handing over">
                🔑 {sg.collectionPassword}
              </span>
            )}
          </div>
        )}
        {a.bookingStatus !== "Confirmed" && (
          <div className="mt-1">
            <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>{a.bookingStatus}</Badge>
          </div>
        )}
      </div>
      <span className="rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={tone}>
        {label}
      </span>
      <div className="flex gap-1.5">
        {st !== "in" && (
          <Button sm disabled={busy} onClick={() => onMark(a.ref, "in")}>
            In
          </Button>
        )}
        {st === "in" && (
          <Button sm disabled={busy} onClick={() => onMark(a.ref, "out")}>
            Out
          </Button>
        )}
        {st === "expected" && (
          <Button sm disabled={busy} onClick={() => onMark(a.ref, "absent")}>
            Absent
          </Button>
        )}
        {st !== "expected" && (
          <Button sm disabled={busy} onClick={() => onMark(a.ref, "expected")} title="Undo — back to expected">
            ↺
          </Button>
        )}
      </div>
    </div>
  );
}

/** registers view — freelancer, company, franchise and staff portals. */
export function RegistersApp() {
  const [date, setDate] = useState(todayIso);
  // Loaded sessions are stamped with their date — switching day shows the
  // loading state until the new day's payload lands (no setState-in-effect).
  const [loaded, setLoaded] = useState<{ date: string; list: Session[] } | null>(null);
  const sessions = loaded && loaded.date === date ? loaded.list : null;
  const [error, setError] = useState<string | null>(null);
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Session[]>(`/api/registers?date=${date}`)
      .then((list) => {
        setLoaded({ date, list });
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load registers"));
  }, [date]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    // Platform accounts can look but never mark.
    apiGet<{ role: string }>("/api/me")
      .then((me) => setReadOnly(me.role === "platform"))
      .catch(() => {});
  }, []);
  useRealtime(["registers", "bookings", "blocks"], refresh);

  async function mark(blockId: string, ref: string, status: "in" | "out" | "absent" | "expected") {
    setBusyRef(ref);
    setError(null);
    try {
      await apiPost(`/api/registers/${encodeURIComponent(blockId)}/${date}/mark`, { ref, status });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t update the register");
    }
    setBusyRef(null);
  }

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          Registers
        </h2>
        <div className="flex items-center gap-1.5">
          <Button sm onClick={() => setDate((d) => shiftDay(d, -1))} aria-label="Previous day">
            ←
          </Button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)]"
          />
          <Button sm onClick={() => setDate((d) => shiftDay(d, 1))} aria-label="Next day">
            →
          </Button>
          {date !== todayIso() && (
            <Button sm onClick={() => setDate(todayIso())}>
              Today
            </Button>
          )}
        </div>
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">
        {dayLabel(date)} — check children in and out as they arrive and leave.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">
          {error}
        </div>
      )}

      {!sessions ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading registers…</div>
      ) : sessions.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          Nothing runs on {dayLabel(date)} — pick another day.
        </Card>
      ) : (
        <div className="flex flex-col gap-3.5">
          {sessions.map((s) => (
            <Card key={s.blockId} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="text-[15px] font-extrabold">{s.listingName}</div>
                  <div className="text-[12px] text-[var(--ink-3)]">
                    {s.blockName} · {s.start} – {s.end}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11.5px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                  <span className="text-[var(--ink-2)]">{s.counts.expected} expected</span>
                  <span style={{ color: "#0f7a44" }}>{s.counts.in} in</span>
                  <span className="text-[var(--ink-3)]">{s.counts.out} out</span>
                  <span style={{ color: "var(--red,#e21d27)" }}>{s.counts.absent} absent</span>
                </div>
              </div>
              <div className="mt-2.5">
                {s.attendees.length === 0 ? (
                  <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">
                    No bookings hold a place on this session yet.
                  </div>
                ) : (
                  s.attendees.map((a) => (
                    <AttendeeRow
                      key={a.ref}
                      a={a}
                      busy={busyRef === a.ref || readOnly}
                      onMark={(ref, status) => mark(s.blockId, ref, status)}
                    />
                  ))
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
