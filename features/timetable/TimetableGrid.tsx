"use client";

import { useEffect, useState } from "react";
import { useTimetableStore } from "./store";
import { facColor, groupIntoWeeks } from "./engine";
import { SWATCHES } from "./data";
import type { Cell, PlanRow } from "./types";

const cellBg = (c: Cell, FAC: string[]) => c.color || facColor(c.place, FAC) || "#64748B";

function ActivityBlock({
  cell,
  FAC,
  draggable,
  onDragStart,
  onClick,
}: {
  cell: Cell;
  FAC: string[];
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onClick?: () => void;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className="flex h-full flex-col justify-center rounded-lg px-2 py-1.5 text-[11.5px] font-bold leading-tight text-white"
      style={{
        background: cellBg(cell, FAC),
        textShadow: "0 1px 2px rgba(0,0,0,.30)",
        cursor: draggable ? "grab" : "default",
      }}
    >
      {cell.cat && <span className="text-[9px] font-bold uppercase tracking-wide opacity-90">{cell.cat}</span>}
      <span>{cell.name}</span>
      {cell.place && <span className="text-[9.5px] font-semibold opacity-90">@ {cell.place}</span>}
    </div>
  );
}

function CellEditor({ initial }: { initial: string }) {
  const cellColor = useTimetableStore((s) => s.cellColor);
  const cellSave = useTimetableStore((s) => s.cellSave);
  const cellClear = useTimetableStore((s) => s.cellClear);
  const [name, setName] = useState(initial);
  useEffect(() => setName(initial), [initial]);

  return (
    <div className="rounded-lg border border-[var(--brand)] bg-[var(--surface)] p-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && cellSave(name)}
        placeholder="Type activity…"
        className="w-full rounded border border-[var(--line)] bg-[var(--surface)] px-1.5 py-1 text-[11.5px] text-[var(--ink)] outline-none"
      />
      <div className="mt-1.5 flex flex-wrap gap-1">
        {SWATCHES.map((x) => (
          <span
            key={x}
            onClick={() => cellColor(x, name)}
            className="h-4 w-4 cursor-pointer rounded"
            style={{ background: x }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <button
          onClick={() => cellSave(name)}
          className="rounded bg-[var(--brand)] px-2.5 py-1 text-[11px] font-bold text-white"
        >
          Done
        </button>
        <button
          onClick={cellClear}
          className="rounded border border-[var(--line)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink)]"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function Banner({ row }: { row: PlanRow }) {
  const lab =
    row.type === "signin" ? "Sign-in" : row.type === "signout" ? "Sign-out" : row.type === "lunch" ? "Lunch" : "Break";
  const tm = row.times ? row.times.join("  ·  ") : row.time;
  const tone =
    row.type === "break"
      ? "bg-[var(--panel)] text-[var(--ink-3)]"
      : "bg-[var(--brand-soft)] text-[var(--brand-strong)]";
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[11.5px] font-bold ${tone}`}
      style={{ gridColumn: "1 / -1" }}
    >
      <b>{lab}</b>
      <span className="opacity-85">{tm}</span>
    </div>
  );
}

function DayGrid() {
  const plan = useTimetableStore((s) => s.plan);
  const cur = useTimetableStore((s) => s.cur);
  const groups = useTimetableStore((s) => s.groups());
  const FAC = useTimetableStore((s) => s.FAC);
  const dayList = useTimetableStore((s) => s.dayList);
  const mode = useTimetableStore((s) => s.mode);
  const edit = useTimetableStore((s) => s.edit);
  const cellEdit = useTimetableStore((s) => s.cellEdit);
  const dropOnCell = useTimetableStore((s) => s.dropOnCell);

  const rows = plan[cur] || [];
  const n = groups.length;
  const man = mode === "manual";
  const d = dayList[cur] ? `${dayList[cur].n} ${(dayList[cur].d || "").split(" ")[0] || ""}` : "";

  const drop = (e: React.DragEvent, r: number, g: number) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove("ring-2");
    dropOnCell(r, g, e.dataTransfer.getData("text"));
  };

  return (
    <div
      className="grid gap-1 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1"
      style={{ gridTemplateColumns: `74px repeat(${n}, 1fr)` }}
    >
      <div className="flex items-center justify-center rounded bg-[var(--panel)] p-2 text-center text-[11px] font-extrabold uppercase text-[var(--ink-2)]">
        {d}
      </div>
      {groups.map((g, i) => {
        const p = g.split("(");
        return (
          <div
            key={i}
            className="rounded bg-[var(--panel)] p-2 text-center text-[11px] font-extrabold uppercase text-[var(--ink-2)]"
          >
            {p[0].trim()}
            {p[1] && <small className="block text-[9.5px] font-semibold normal-case text-[var(--ink-3)]">{p[1].replace(")", "")}</small>}
          </div>
        );
      })}

      {rows.map((r, ri) => {
        if (r.whole) {
          return (
            <div key={ri} style={{ display: "contents" }}>
              <div className="flex items-center justify-end rounded bg-[var(--panel)] px-1.5 py-2 text-right text-[11px] font-bold text-[var(--ink-3)]">
                {r.time}
              </div>
              <div style={{ gridColumn: `span ${n}` }}>
                <div
                  className="flex flex-col justify-center rounded-lg px-2.5 py-2 text-[11.5px] font-bold text-white"
                  style={{ background: r.whole.color, textShadow: "0 1px 2px rgba(0,0,0,.3)" }}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wide opacity-90">{r.whole.cat}</span>
                  <span>{r.whole.name}</span>
                  <span className="text-[9.5px] font-semibold opacity-90">
                    Whole camp · {r.whole.place || "all groups"}
                  </span>
                </div>
              </div>
            </div>
          );
        }
        if (r.cells) {
          return (
            <div key={ri} style={{ display: "contents" }}>
              <div className="flex items-center justify-end rounded bg-[var(--panel)] px-1.5 py-2 text-right text-[11px] font-bold text-[var(--ink-3)]">
                {r.time}
              </div>
              {r.cells.map((c, gi) => {
                const editing = man && edit && edit.r === ri && edit.g === gi;
                if (editing) {
                  return (
                    <div key={gi}>
                      <CellEditor initial={c.name || ""} />
                    </div>
                  );
                }
                if (man && !c.name) {
                  return (
                    <div
                      key={gi}
                      onClick={() => cellEdit(ri, gi)}
                      className="flex min-h-[42px] cursor-pointer items-center justify-center rounded-lg border border-dashed border-[var(--line)] text-[18px] text-[var(--ink-3)] hover:border-[var(--brand)]"
                    >
                      +
                    </div>
                  );
                }
                return (
                  <div
                    key={gi}
                    onDragOver={(e) => {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).classList.add("ring-2");
                    }}
                    onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove("ring-2")}
                    onDrop={(e) => drop(e, ri, gi)}
                    className="rounded-lg ring-[var(--brand)]"
                  >
                    <ActivityBlock
                      cell={c}
                      FAC={FAC}
                      draggable={!man}
                      onDragStart={(e) => e.dataTransfer.setData("text", `cell|${ri}|${gi}`)}
                      onClick={man ? () => cellEdit(ri, gi) : undefined}
                    />
                  </div>
                );
              })}
            </div>
          );
        }
        return <Banner key={ri} row={r} />;
      })}
    </div>
  );
}

function WeekGrid() {
  const plan = useTimetableStore((s) => s.plan);
  const cur = useTimetableStore((s) => s.cur);
  const groups = useTimetableStore((s) => s.groups());
  const FAC = useTimetableStore((s) => s.FAC);
  const dayList = useTimetableStore((s) => s.dayList);

  const weeks = groupIntoWeeks(dayList);
  let wi = 0;
  weeks.forEach((wk, i) => {
    if (wk.some((o) => o.di === cur)) wi = i;
  });
  const wk = weeks[wi] || [];
  if (!wk.length) return <div className="text-[var(--ink-3)]">No days yet.</div>;
  const tmpl = plan[wk[0].di] || [];
  const cols = wk.length;
  const gshort = groups.map((g) => g.split("(")[0].trim());

  return (
    <div>
      <div className="mb-2.5 text-[14px] font-extrabold text-[var(--ink-2)]">Week {wi + 1}</div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `56px repeat(${cols}, minmax(0,1fr))` }}>
        <div />
        {wk.map((o, i) => (
          <div key={i} className="rounded bg-[var(--panel)] p-1.5 text-center text-[11px] font-extrabold text-[var(--ink-2)]">
            {o.day.n}
            <small className="block text-[9.5px] font-semibold text-[var(--ink-3)]">{o.day.d}</small>
          </div>
        ))}
        {tmpl.map((tr, ri) => {
          if (tr.whole || tr.cells) {
            return (
              <div key={ri} style={{ display: "contents" }}>
                <div className="flex items-center justify-end pr-1 text-[10px] font-bold text-[var(--ink-3)]">{tr.time}</div>
                {wk.map((o, ci) => {
                  const row = (plan[o.di] || [])[ri] || {};
                  if (row.whole) {
                    return (
                      <div key={ci} className="p-0.5">
                        <div className="rounded p-1 text-[10px] font-bold text-white" style={{ background: row.whole.color }}>
                          {row.whole.name}
                          <small className="block opacity-80">whole camp</small>
                        </div>
                      </div>
                    );
                  }
                  if (row.cells) {
                    return (
                      <div key={ci} className="flex flex-col gap-0.5 p-0.5">
                        {row.cells.map((c, gi) => (
                          <div key={gi} className="rounded px-1 py-0.5 text-[9.5px] font-semibold text-white" style={{ background: cellBg(c, FAC) }}>
                            <b className="mr-1">{gshort[gi] || ""}</b>
                            {c.name}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return <div key={ci} />;
                })}
              </div>
            );
          }
          const lab = tr.type === "signin" ? "Sign-in" : tr.type === "signout" ? "Sign-out" : tr.type === "lunch" ? "Lunch" : "Break";
          const tm = tr.times ? tr.times.join(" / ") : tr.time;
          return (
            <div key={ri} style={{ display: "contents" }}>
              <div />
              <div
                className="flex items-center justify-between rounded bg-[var(--brand-soft)] px-2 py-1 text-[10.5px] font-bold text-[var(--brand-strong)]"
                style={{ gridColumn: `span ${cols}` }}
              >
                <b>{lab}</b>
                <span className="opacity-80">{tm}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid() {
  const plan = useTimetableStore((s) => s.plan);
  const dayList = useTimetableStore((s) => s.dayList);
  const FAC = useTimetableStore((s) => s.FAC);
  const setView = useTimetableStore((s) => s.setView);
  const showDay = useTimetableStore((s) => s.showDay);

  const weeks = groupIntoWeeks(dayList);
  if (!weeks.length) return <div className="text-[var(--ink-3)]">No dates yet — pick a listing in Setup.</div>;

  return (
    <div>
      {weeks.slice(0, 4).map((wk, wi) => (
        <div key={wi} className="mb-4">
          <div className="mb-1.5 text-[13.5px] font-extrabold text-[var(--ink-2)]">Week {wi + 1}</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, wk.length)}, minmax(0,1fr))` }}>
            {wk.map((o, ci) => {
              const rows = plan[o.di] || [];
              const acts: { n: string; col: string; w?: boolean }[] = [];
              const seen: Record<string, boolean> = {};
              rows.forEach((r) => {
                if (r.cells)
                  r.cells.forEach((c) => {
                    if (c.name && c.name !== "Free Play" && !seen[c.name]) {
                      seen[c.name] = true;
                      acts.push({ n: c.name, col: cellBg(c, FAC) });
                    }
                  });
                if (r.whole && !seen[r.whole.name]) {
                  seen[r.whole.name] = true;
                  acts.push({ n: r.whole.name, col: r.whole.color, w: true });
                }
              });
              return (
                <div
                  key={ci}
                  onClick={() => {
                    setView("day");
                    showDay(o.di);
                  }}
                  className="cursor-pointer rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 hover:border-[var(--brand)]"
                >
                  <div className="mb-1.5 text-[13px] font-extrabold text-[var(--ink)]">
                    {o.day.n} <span className="font-semibold text-[var(--ink-3)]">{o.day.d}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {acts.length ? (
                      acts.map((a, i) => (
                        <span key={i} className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: a.col }}>
                          {a.w ? "★ " : ""}
                          {a.n}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-[var(--ink-3)]">no activities</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Legend() {
  const FAC = useTimetableStore((s) => s.FAC);
  const facOn = useTimetableStore((s) => s.facOn);
  const avail = (FAC || []).filter((f) => facOn[f] !== false);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-3)]">
      <span className="font-extrabold text-[var(--ink-2)]">Facilities available:</span>
      {avail.length ? (
        avail.map((f) => (
          <span key={f} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-0.5 font-bold text-[var(--ink-2)]">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: facColor(f, FAC) }} />
            {f}
          </span>
        ))
      ) : (
        <span>none ticked — add spaces in Setup</span>
      )}
    </div>
  );
}

export function TimetableGrid() {
  const view = useTimetableStore((s) => s.view);
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      {view === "week" ? <WeekGrid /> : view === "month" ? <MonthGrid /> : <DayGrid />}
      <Legend />
    </div>
  );
}
