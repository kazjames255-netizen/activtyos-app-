"use client";

import { useState } from "react";
import { useTimetableStore } from "./store";
import { shortGroup } from "./engine";
import { Input } from "@/components/ui";

function AddRow({ cid }: { cid: string }) {
  const addAct = useTimetableStore((s) => s.addAct);
  const [v, setV] = useState("");
  return (
    <div className="mt-2 flex gap-1.5">
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            addAct(cid, v);
            setV("");
          }
        }}
        placeholder="Add activity…"
        className="flex-1"
      />
      <button
        onClick={() => {
          addAct(cid, v);
          setV("");
        }}
        className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--ink)]"
      >
        Add
      </button>
    </div>
  );
}

export function ActivityLibrary() {
  const CATS = useTimetableStore((s) => s.CATS);
  const FAC = useTimetableStore((s) => s.FAC);
  const openCat = useTimetableStore((s) => s.openCat);
  const groups = useTimetableStore((s) => s.groups());
  const toggleCatOpen = useTimetableStore((s) => s.toggleCatOpen);
  const toggleActOn = useTimetableStore((s) => s.toggleActOn);
  const setActPlace = useTimetableStore((s) => s.setActPlace);
  const toggleActWhole = useTimetableStore((s) => s.toggleActWhole);
  const toggleActGroup = useTimetableStore((s) => s.toggleActGroup);
  const delAct = useTimetableStore((s) => s.delAct);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {CATS.map((c) => {
        const onN = c.acts.filter((a) => a.on).length;
        const open = openCat[c.id];
        return (
          <div
            key={c.id}
            className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]"
            style={{ borderLeft: `4px solid ${c.color}` }}
          >
            <div
              onClick={() => toggleCatOpen(c.id)}
              className="flex cursor-pointer items-center gap-2 px-3 py-2.5"
            >
              <span className="h-3 w-3 flex-none rounded" style={{ background: c.color }} />
              <b className="font-[var(--ff-display)] text-[14.5px] font-extrabold text-[var(--ink)]">{c.name}</b>
              <span className="ml-auto text-[11px] font-bold text-[var(--ink-3)]">
                {onN}/{c.acts.length} on
              </span>
              <span className="text-[var(--ink-3)]">{open ? "▲" : "▼"}</span>
            </div>
            {open && (
              <div className="px-3 pb-3">
                {c.acts.map((a, idx) => (
                  <div
                    key={idx}
                    className={`mb-1.5 flex flex-wrap items-center gap-1.5 ${a.on ? "" : "opacity-50"}`}
                  >
                    <span
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("text", `lib|${a.name}|${c.color}|${c.name}|${a.place || ""}`)
                      }
                      className="cursor-grab rounded px-2 py-1 text-[11.5px] font-bold text-white"
                      style={{ background: c.color }}
                    >
                      {a.name}
                    </span>
                    <button
                      onClick={() => toggleActOn(c.id, idx)}
                      className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${
                        a.on
                          ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                          : "border-[var(--line)] text-[var(--ink-3)]"
                      }`}
                    >
                      {a.on ? "On" : "Off"}
                    </button>
                    <select
                      value={a.place}
                      onChange={(e) => setActPlace(c.id, idx, e.target.value)}
                      title="Where it runs"
                      className="rounded border border-[var(--line)] bg-[var(--surface)] px-1 py-0.5 text-[10.5px] text-[var(--ink)]"
                    >
                      {FAC.map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => toggleActWhole(c.id, idx)}
                      title="Whole camp"
                      className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${
                        a.whole
                          ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                          : "border-[var(--line)] text-[var(--ink-3)]"
                      }`}
                    >
                      Whole
                    </button>
                    {groups.map((g, gi) => {
                      const ex = a.exclude.indexOf(gi) >= 0;
                      return (
                        <button
                          key={gi}
                          onClick={() => toggleActGroup(c.id, idx, gi)}
                          title={g}
                          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${
                            ex
                              ? "border-[var(--line)] text-[var(--ink-3)] line-through"
                              : "border-[var(--brand-line)] text-[var(--brand)]"
                          }`}
                        >
                          {shortGroup(g)}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => delAct(c.id, idx)}
                      title="Remove"
                      className="ml-auto text-[15px] text-[var(--ink-3)] hover:text-[var(--red)]"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <AddRow cid={c.id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
