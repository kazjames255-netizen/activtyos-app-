"use client";

import { useState } from "react";
import { useTimetableStore } from "./store";
import { buildAllDays } from "./engine";
import { ActivityLibrary } from "./ActivityLibrary";
import { FieldLabel, Panel, Button, Input, Select, inputCls } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { useI18n, useT } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";
import { dayShort, dayDateText, ttName } from "./engine";

// Step chrome follows the operator's brand theme (was a fixed rainbow that
// clashed on non-blue themes). Activity-block colours stay varied — see engine.
const PILLS: [number, string][] = [
  [1, "wzDates"],
  [2, "wzDay"],
  [3, "wzArrivals"],
  [4, "wzSpaces"],
  [5, "wzGroups"],
  [6, "wzActivities"],
  [7, "wzBuild"],
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
  const t = useT();
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
        + {t("p8set.add")}
      </Button>
    </div>
  );
}

function DayCalendar() {
  const t = useT();
  const dateFrom = useTimetableStore((s) => s.dateFrom);
  const dateTo = useTimetableStore((s) => s.dateTo);
  const excluded = useTimetableStore((s) => s.excluded);
  const toggleDate = useTimetableStore((s) => s.toggleDate);
  const all = buildAllDays(dateFrom, dateTo);
  if (!all.length || !all[0].iso)
    return <span className="text-[11.5px] text-[var(--ink-3)]">{t("p8set.wzPickRange")}</span>;
  const inc = all.filter((x) => !excluded[x.iso]).length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((x) => {
        const ex = !!excluded[x.iso];
        return (
          <span
            key={x.iso}
            onClick={() => toggleDate(x.iso)}
            title={ex ? t("p8set.wzExcluded") : t("p8set.wzIncluded")}
            className={`flex min-w-[46px] cursor-pointer flex-col items-center gap-px rounded-lg border-[1.5px] px-2.5 py-1.5 ${
              ex ? "border-[var(--line)] bg-[var(--surface)] opacity-60" : "border-[var(--brand)] bg-[var(--brand-soft)]"
            }`}
          >
            <span className={`text-[10px] font-extrabold uppercase ${ex ? "text-[var(--ink-3)]" : "text-[var(--brand-strong)]"}`}>
              {dayShort(x)}
            </span>
            <span className={`text-[12.5px] font-bold text-[var(--ink)] ${ex ? "line-through" : ""}`}>{dayDateText(x)}</span>
          </span>
        );
      })}
      <div className="mt-1 w-full text-[11px] text-[var(--ink-3)]">
        {t("p8set.wzDaysIncluded", { n: inc, total: all.length })}
      </div>
    </div>
  );
}

export function SetupWizard() {
  const t = useT();
  const { locale } = useI18n();
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
              {t(`p8set.${lbl}`)}
            </button>
          );
        })}
      </div>

      {step === 1 && (
        <Panel title={t("p8set.wzStep1")}>
          <div className="flex flex-wrap items-end gap-3">
            {seasons.length > 0 && (
              <div className="min-w-[160px]">
                <FieldLabel>{t("p8set.wzSeason")}</FieldLabel>
                <Select value={seasonFilter} onChange={(e) => onSeason(e.target.value)} className="w-full">
                  <option value="">{t("p8set.wzAllSeasons")}</option>
                  {seasons.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="min-w-[230px] flex-1">
              <FieldLabel>{t("p8set.vListing")}</FieldLabel>
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
                {listingOpts.length === 0 && <option value={s.listingIndex}>{t("p8set.wzNoListingsSeason")}</option>}
              </Select>
            </div>
            <div>
              <FieldLabel>{t("p8set.wzFrom")}</FieldLabel>
              <Input type="date" value={s.dateFrom} onChange={(e) => s.setDates(e.target.value, s.dateTo)} />
            </div>
            <div>
              <FieldLabel>{t("p8set.wzTo")}</FieldLabel>
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
                ? t("p8set.wzPulled", { dates: s.curListing.dates, start: s.start, end: s.end, venue: s.curListing.venue, days: pickPlural(t, locale, "p8set.wzNDays", s.dayList.length) })
                : t("p8set.wzEdited", { days: pickPlural(t, locale, "p8set.wzNDays", s.dayList.length), start: s.start, end: s.end })}
            </span>
          </div>
          <FieldLabel>
            <span className="mt-3 inline-block">{t("p8set.wzDatesInCamp")}</span>
          </FieldLabel>
          <DayCalendar />
        </Panel>
      )}

      {step === 2 && (
        <Panel title={t("p8set.wzStep2")}>
          <div className="flex flex-wrap gap-4">
            <label>
              <FieldLabel>{t("p8set.wzDayStart")}</FieldLabel>
              <Input type="time" value={s.start} onChange={(e) => s.setField({ start: e.target.value })} />
            </label>
            <label>
              <FieldLabel>{t("p8set.wzDayEnd")}</FieldLabel>
              <Input type="time" value={s.end} onChange={(e) => s.setField({ end: e.target.value })} />
            </label>
            <label>
              <FieldLabel>{t("p8set.wzBreaks")}</FieldLabel>
              <Select value={s.breaks} onChange={(e) => s.setField({ breaks: +e.target.value })}>
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <FieldLabel>{t("p8set.wzLunchStart")}</FieldLabel>
              <Input type="time" value={s.lunch} onChange={(e) => s.setField({ lunch: e.target.value })} />
            </label>
            <label>
              <FieldLabel>{t("p8set.wzActsPerDay")}</FieldLabel>
              <Select value={s.perDay} onChange={(e) => s.setField({ perDay: +e.target.value })}>
                {[4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </label>
            <div className="min-w-[210px]">
              <FieldLabel>{t("p8set.wzWholeAt")}</FieldLabel>
              <Chips times={s.wholeTimes} onDel={s.delWhole} />
              <TimeAdder onAdd={s.addWhole} />
            </div>
          </div>
        </Panel>
      )}

      {step === 3 && (
        <Panel title={t("p8set.wzStep3")}>
          <div className="flex flex-wrap gap-8">
            <div className="min-w-[240px]">
              <FieldLabel>{t("p8set.wzSignIn")}</FieldLabel>
              <Chips times={s.signin} onDel={(i) => s.delSign("signin", i)} />
              <TimeAdder onAdd={(t) => s.addSign("signin", t)} />
            </div>
            <div className="min-w-[240px]">
              <FieldLabel>{t("p8set.wzSignOut")}</FieldLabel>
              <Chips times={s.signout} onDel={(i) => s.delSign("signout", i)} />
              <TimeAdder onAdd={(t) => s.addSign("signout", t)} />
            </div>
          </div>
        </Panel>
      )}

      {step === 4 && (
        <Panel title={t("p8set.wzStep4")}>
          <Facilities />
        </Panel>
      )}

      {step === 5 && (
        <Panel title={t("p8set.wzStep5")}>
          <GroupsEditor />
          <FieldLabel>
            <span className="mt-3.5 inline-block">{t("p8set.wzCatsRotation")}</span>
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
                  {ttName(t, c.name)}
                </button>
              );
            })}
          </div>
        </Panel>
      )}

      {step === 6 && (
        <Panel title={t("p8set.wzStep6")}>
          <ActivityLibrary />
        </Panel>
      )}

      {step === 7 && (
        <Panel title={t("p8set.wzStep7")}>
          <div className="flex flex-wrap gap-3.5">
            {(
              [
                ["auto", t("p8set.wzAutoTitle"), t("p8set.wzAutoDesc")],
                ["manual", t("p8set.wzManualTitle"), t("p8set.wzManualDesc")],
              ] as const
            ).map(([mode, title, desc]) => (
              <button
                key={mode}
                onClick={() => {
                  s.generate(mode);
                  s.setTab(1);
                }}
                className={`flex max-w-[340px] flex-1 flex-col items-start gap-1.5 rounded-xl border-[1.5px] p-4 text-start ${
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
          {t("p8set.wzBack")}
        </Button>
        {step < 7 && (
          <Button variant="solid" onClick={() => s.setWizStep(step + 1)}>
            {t("p8set.wzNext")}
          </Button>
        )}
      </div>
    </div>
  );
}

function Facilities() {
  const t = useT();
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
              {ttName(t, f)}
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
          placeholder={t("p8set.wzAddSpacePh")}
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
          + {t("p8set.add")}
        </Button>
      </div>
    </div>
  );
}

function GroupsEditor() {
  const t = useT();
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
      <FieldLabel>{t("p8set.wzGroupsLbl")}</FieldLabel>
      <div className="mb-2 flex flex-wrap gap-2">
        {groupsList.map((g, i) => (
          <span
            key={i}
            className="inline-flex flex-col items-start gap-px rounded-[10px] border-[1.5px] border-[var(--brand)] bg-[var(--brand-soft)] px-2.5 py-1.5"
          >
            <span className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-[var(--ink)]">
              {g.name}
              <button onClick={() => delGroup(i)} title={t("p8set.lcRemove")} className="text-[15px] leading-none text-[var(--ink-3)]">
                ×
              </button>
            </span>
            {g.band ? (
              <span className="text-[10.5px] font-bold text-[var(--brand-strong)]">{g.band}</span>
            ) : (
              <span className="text-[10px] text-[var(--ink-3)]">{t("p8set.wzNoBand")}</span>
            )}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("p8set.wzGroupNamePh")}
          className="max-w-[160px]"
        />
        <Input
          value={band}
          onChange={(e) => setBand(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("p8set.wzBandPh")}
          className="max-w-[150px]"
        />
        <Button onClick={add}>+ {t("p8set.grpAdd")}</Button>
      </div>
    </div>
  );
}
