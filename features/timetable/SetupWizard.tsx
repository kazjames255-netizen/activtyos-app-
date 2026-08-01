"use client";

import { useState } from "react";
import { useTimetableStore } from "./store";
import { buildAllDays } from "./engine";
import { ActivityLibrary } from "./ActivityLibrary";
import { FieldLabel, Panel, Button, Input, Select, inputCls } from "@/components/ui";
import { useSettings } from "@/lib/settings";

// Step chrome follows the operator's brand theme (was a fixed rainbow that
// clashed on non-blue themes). Activity-block colours stay varied — see engine.
const PILLS: [number, string][] = [
  [1, "Dates"],
  [2, "The day"],
  [3, "Arrivals"],
  [4, "Spaces"],
  [5, "Groups"],
  [6, "Activities"],
  [7, "Build"],
];

function Chips({ times, onDel }: { times: string[]; onDel: (i: number) => void }) {
  return (
    <div className="mb-1.5 flex flex-wrap gap-1.5">
      {times.map((t, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-soft)] px-2 py-0.5 text-[12px] font-bold text-[var(--brand-strong)]"
        >
          {t}
          <button onClick={() => onDel(i)} className="text-[14px] leading-none text-[var(--ink-3)]">
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

function TimeAdder({ onAdd }: { onAdd: (t: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-1.5">
      <Input type="time" value={v} onChange={(e) => setV(e.target.value)} className="max-w-[120px]" />
      <Button
        onClick={() => {
          if (v) {
            onAdd(v);
            setV("");
          }
        }}
      >
        + Add
      </Button>
    </div>
  );
}

function DayCalendar() {
  const dateFrom = useTimetableStore((s) => s.dateFrom);
  const dateTo = useTimetableStore((s) => s.dateTo);
  const excluded = useTimetableStore((s) => s.excluded);
  const toggleDate = useTimetableStore((s) => s.toggleDate);
  const all = buildAllDays(dateFrom, dateTo);
  if (!all.length || !all[0].iso)
    return <span className="text-[11.5px] text-[var(--ink-3)]">Pick a date range above.</span>;
  const inc = all.filter((x) => !excluded[x.iso]).length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((x) => {
        const ex = !!excluded[x.iso];
        return (
          <span
            key={x.iso}
            onClick={() => toggleDate(x.iso)}
            title={ex ? "Excluded — tap to include" : "Included — tap to exclude"}
            className={`flex min-w-[46px] cursor-pointer flex-col items-center gap-px rounded-lg border-[1.5px] px-2.5 py-1.5 ${
              ex ? "border-[var(--line)] bg-[var(--surface)] opacity-60" : "border-[var(--brand)] bg-[var(--brand-soft)]"
            }`}
          >
            <span className={`text-[10px] font-extrabold uppercase ${ex ? "text-[var(--ink-3)]" : "text-[var(--brand-strong)]"}`}>
              {x.n}
            </span>
            <span className={`text-[12.5px] font-bold text-[var(--ink)] ${ex ? "line-through" : ""}`}>{x.d}</span>
          </span>
        );
      })}
      <div className="mt-1 w-full text-[11px] text-[var(--ink-3)]">
        {inc} of {all.length} days included
      </div>
    </div>
  );
}

export function SetupWizard() {
  const s = useTimetableStore();
  const step = s.wstep;
  const { settings } = useSettings();
  const seasons = settings.seasons ?? [];
  const [seasonFilter, setSeasonFilter] = useState("");
  const seasonName = (id?: string | null) => seasons.find((x) => x.id === id)?.name;
  // Options are {listing, its real index in LISTINGS} so the picker's value
  // stays the true index even when the season filter hides some rows.
  const listingOpts = s.LISTINGS.map((l, i) => ({ l, i })).filter(({ l }) => !seasonFilter || l.seasonId === seasonFilter);
  const onSeason = (v: string) => {
    setSeasonFilter(v);
    // If the current pick isn't in the chosen season, jump to the first that is.
    if (v && s.curListing?.seasonId !== v) {
      const first = s.LISTINGS.findIndex((l) => l.seasonId === v);
      if (first >= 0) s.pickListing(first);
    }
  };

  return (
    <div>
      {/* Pills */}
      <div className="mb-3.5 flex flex-wrap gap-2">
        {PILLS.map(([n, lbl]) => {
          const on = n === step;
          const done = n < step;
          return (
            <button
              key={n}
              onClick={() => s.setWizStep(n)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${
                on
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--ink)]"
                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"
              }`}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                style={{ background: "var(--brand)", opacity: done ? 0.5 : 1 }}
              >
                {n}
              </span>
              {lbl}
            </button>
          );
        })}
      </div>

      {step === 1 && (
        <Panel title="1 · Listing & dates">
          <div className="flex flex-wrap items-end gap-3">
            {seasons.length > 0 && (
              <div className="min-w-[160px]">
                <FieldLabel>Season</FieldLabel>
                <Select value={seasonFilter} onChange={(e) => onSeason(e.target.value)} className="w-full">
                  <option value="">All seasons</option>
                  {seasons.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="min-w-[230px] flex-1">
              <FieldLabel>Listing</FieldLabel>
              <Select
                value={s.listingIndex}
                onChange={(e) => s.pickListing(+e.target.value)}
                className="w-full"
              >
                {listingOpts.map(({ l, i }) => (
                  <option key={i} value={i}>
                    {l.name}
                  </option>
                ))}
                {listingOpts.length === 0 && <option value={s.listingIndex}>No listings in this season</option>}
              </Select>
            </div>
            <div>
              <FieldLabel>From</FieldLabel>
              <Input type="date" value={s.dateFrom} onChange={(e) => s.setDates(e.target.value, s.dateTo)} />
            </div>
            <div>
              <FieldLabel>To</FieldLabel>
              <Input type="date" value={s.dateTo} onChange={(e) => s.setDates(s.dateFrom, e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-2)]">
            {seasonName(s.curListing?.seasonId) && (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white" style={{ background: "linear-gradient(120deg,#2f9fb8,#12586e)" }}>
                📅 {seasonName(s.curListing?.seasonId)}
              </span>
            )}
            <span>
              {s.curListing
                ? `Pulled from listing: ${s.curListing.dates} · ${s.start}–${s.end} · ${s.curListing.venue} · ${s.dayList.length} days`
                : `Dates edited · ${s.dayList.length} days · ${s.start}–${s.end}`}
            </span>
          </div>
          <FieldLabel>
            <span className="mt-3 inline-block">Dates in this camp</span>
          </FieldLabel>
          <DayCalendar />
        </Panel>
      )}

      {step === 2 && (
        <Panel title="2 · The day">
          <div className="flex flex-wrap gap-4">
            <label>
              <FieldLabel>Day start</FieldLabel>
              <Input type="time" value={s.start} onChange={(e) => s.setField({ start: e.target.value })} />
            </label>
            <label>
              <FieldLabel>Day end</FieldLabel>
              <Input type="time" value={s.end} onChange={(e) => s.setField({ end: e.target.value })} />
            </label>
            <label>
              <FieldLabel>Breaks / day</FieldLabel>
              <Select value={s.breaks} onChange={(e) => s.setField({ breaks: +e.target.value })}>
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <FieldLabel>Lunch start</FieldLabel>
              <Input type="time" value={s.lunch} onChange={(e) => s.setField({ lunch: e.target.value })} />
            </label>
            <label>
              <FieldLabel>Activities per day</FieldLabel>
              <Select value={s.perDay} onChange={(e) => s.setField({ perDay: +e.target.value })}>
                {[4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </label>
            <div className="min-w-[210px]">
              <FieldLabel>Whole-camp activities at</FieldLabel>
              <Chips times={s.wholeTimes} onDel={s.delWhole} />
              <TimeAdder onAdd={s.addWhole} />
            </div>
          </div>
        </Panel>
      )}

      {step === 3 && (
        <Panel title="3 · Arrivals">
          <div className="flex flex-wrap gap-8">
            <div className="min-w-[240px]">
              <FieldLabel>Sign-in times</FieldLabel>
              <Chips times={s.signin} onDel={(i) => s.delSign("signin", i)} />
              <TimeAdder onAdd={(t) => s.addSign("signin", t)} />
            </div>
            <div className="min-w-[240px]">
              <FieldLabel>Sign-out times</FieldLabel>
              <Chips times={s.signout} onDel={(i) => s.delSign("signout", i)} />
              <TimeAdder onAdd={(t) => s.addSign("signout", t)} />
            </div>
          </div>
        </Panel>
      )}

      {step === 4 && (
        <Panel title="4 · Facilities available">
          <Facilities />
        </Panel>
      )}

      {step === 5 && (
        <Panel title="5 · Groups & categories">
          <GroupsEditor />
          <FieldLabel>
            <span className="mt-3.5 inline-block">Categories in the rotation (tap to include)</span>
          </FieldLabel>
          <div className="flex flex-wrap gap-2">
            {s.CATS.map((c) => {
              const on = s.enabledCatIds[c.id];
              return (
                <button
                  key={c.id}
                  onClick={() => s.toggleCat(c.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold"
                  style={{
                    background: on ? c.color : "var(--surface)",
                    borderColor: on ? c.color : "var(--line)",
                    color: on ? "#fff" : "var(--ink)",
                  }}
                >
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: on ? "#fff" : c.color }} />
                  {c.name}
                </button>
              );
            })}
          </div>
        </Panel>
      )}

      {step === 6 && (
        <Panel title="6 · Activity bank">
          <ActivityLibrary />
        </Panel>
      )}

      {step === 7 && (
        <Panel title="7 · Build it">
          <div className="flex flex-wrap gap-3.5">
            {(
              [
                ["auto", "Automatic →", "We rotate your activities across the week — maximising variety, respecting facilities, whole-camp activities & age groups."],
                ["manual", "Manual →", "Blank template with your dates, times, breaks & sign-in/out. Click any block to type the activity and pick its colour (or drag from the bank)."],
              ] as const
            ).map(([mode, title, desc]) => (
              <button
                key={mode}
                onClick={() => {
                  s.generate(mode);
                  s.setTab(1);
                }}
                className={`flex max-w-[340px] flex-1 flex-col items-start gap-1.5 rounded-xl border-[1.5px] p-4 text-left ${
                  s.mode === mode ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-[var(--surface)]"
                }`}
              >
                <b className="text-[14px] text-[var(--ink)]">{title}</b>
                <span className="text-[11.5px] text-[var(--ink-3)]">{desc}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {/* Wizard nav */}
      <div className="mt-3 flex justify-between">
        <Button onClick={() => s.setWizStep(step - 1)} className={step <= 1 ? "invisible" : ""}>
          ← Back
        </Button>
        {step < 7 && (
          <Button variant="solid" onClick={() => s.setWizStep(step + 1)}>
            Next →
          </Button>
        )}
      </div>
    </div>
  );
}

function Facilities() {
  const FAC = useTimetableStore((s) => s.FAC);
  const facOn = useTimetableStore((s) => s.facOn);
  const toggleFac = useTimetableStore((s) => s.toggleFac);
  const addFac = useTimetableStore((s) => s.addFac);
  const [v, setV] = useState("");
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FAC.map((f) => {
          const on = facOn[f] !== false;
          return (
            <button
              key={f}
              onClick={() => toggleFac(f)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold"
              style={{
                background: on ? "var(--brand)" : "var(--surface)",
                borderColor: on ? "var(--brand)" : "var(--line)",
                color: on ? "#fff" : "var(--ink)",
              }}
            >
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: on ? "#fff" : "var(--brand)" }} />
              {f}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex gap-1.5">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && v.trim()) {
              addFac(v);
              setV("");
            }
          }}
          placeholder="Add a space… (e.g. Tennis court)"
          className={`${inputCls} max-w-[220px]`}
        />
        <Button
          onClick={() => {
            if (v.trim()) {
              addFac(v);
              setV("");
            }
          }}
        >
          + Add
        </Button>
      </div>
    </div>
  );
}

function GroupsEditor() {
  const groupsList = useTimetableStore((s) => s.groupsList);
  const addGroup = useTimetableStore((s) => s.addGroup);
  const delGroup = useTimetableStore((s) => s.delGroup);
  const [name, setName] = useState("");
  const [band, setBand] = useState("");
  const add = () => {
    if (name.trim()) {
      addGroup(name, band);
      setName("");
      setBand("");
    }
  };
  return (
    <div>
      <FieldLabel>Groups (add each group — age band optional)</FieldLabel>
      <div className="mb-2 flex flex-wrap gap-2">
        {groupsList.map((g, i) => (
          <span
            key={i}
            className="inline-flex flex-col items-start gap-px rounded-[10px] border-[1.5px] border-[var(--brand)] bg-[var(--brand-soft)] px-2.5 py-1.5"
          >
            <span className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-[var(--ink)]">
              {g.name}
              <button onClick={() => delGroup(i)} title="Remove" className="text-[15px] leading-none text-[var(--ink-3)]">
                ×
              </button>
            </span>
            {g.band ? (
              <span className="text-[10.5px] font-bold text-[var(--brand-strong)]">{g.band}</span>
            ) : (
              <span className="text-[10px] text-[var(--ink-3)]">no age band</span>
            )}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Group name (e.g. Reds)"
          className="max-w-[160px]"
        />
        <Input
          value={band}
          onChange={(e) => setBand(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Age band — optional"
          className="max-w-[150px]"
        />
        <Button onClick={add}>+ Add group</Button>
      </div>
    </div>
  );
}
