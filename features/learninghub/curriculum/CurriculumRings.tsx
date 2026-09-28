"use client";

import { useEffect, useMemo, useState } from "react";
import { FOCUS, Icon } from "../kit";
import { getMap, type CurriculumMap } from "./api";
import { Ring } from "./CurriculumCard";
import { useT } from "@/lib/i18n/provider";
import { GlassOrb } from "../shared-ui/GlassOrb";
import { subjectSwatch } from "../subjectColour";
import { GROUP_ORDER, childSummary, groupLabel, summarise } from "./cells";

// The curriculum at a glance, on the Progress tab: one ring per subject.
//  Tutor: how much of the national curriculum their lessons cover (% of areas with 5+ lessons).
//  Child: how much of it the child has started (% of expected areas with at least one lesson given).
// Tap "Open the curriculum map" for the full grid (it is the first thing on the Lessons tab).

export function CurriculumRings({ qs, canEdit, onOpenMap }: { qs: string; canEdit: boolean; onOpenMap: () => void }) {
  const t = useT();
  const [data, setData] = useState<CurriculumMap | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setData(null); setFailed(false);
    getMap(qs, "nc2014").then((d) => { if (live) setData(d); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [qs]);

  const rings = useMemo(() => {
    if (!data) return [];
    return GROUP_ORDER.flatMap((g) => {
      const areas = data.areas.filter((a) => a.group === g);
      const ids = new Set(areas.map((a) => a.id));
      if (!areas.some((a) => a.y.some((n) => n > 0))) return [];
      const rows = data.rows.filter((r) => ids.has(r.areaId));
      if (canEdit) {
        const s = summarise(data.rows, ids), lessons = areas.reduce((n, a) => n + a.y.reduce((x, y) => x + y, 0), 0);
        // No checklist for this subject (languages): a lesson count, not a misleading 0%.
        return [s.checked === 0 ? { g, pct: 0, count: lessons, line: t("hublessons.rgLessonsPlaced") } : { g, pct: s.pct, count: undefined, line: t("hublessons.rgAreasOf", { a: s.covered, b: s.checked }) }];
      }
      const c = childSummary(areas, rows);
      return [{ g, pct: c.pct, count: undefined, line: "★".repeat(Math.round(c.pct / 20)) + "☆".repeat(5 - Math.round(c.pct / 20)) }];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, canEdit, t]);

  if (failed || (data && rings.length === 0 && !canEdit)) return null; // never get in the way of the real progress screen
  return (
    <section aria-label={t("hublessons.rgGlance")} data-testid="curriculum-rings" className="mb-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-2xl text-white" style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-2))" }}><Icon name="layers" size={17} /></span>
        <h3 className="m-0 min-w-0 flex-1 text-[16px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{canEdit ? t("hublessons.rgCoverage") : t("hublessons.rgJourney")}</h3>
        <button type="button" onClick={onOpenMap} className={`min-h-[40px] rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-[13px] font-extrabold text-[var(--ink)] ${FOCUS}`}>{t("hublessons.rgOpenMap")}</button>
      </div>
      {!data ? <p className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">{t("hublessons.edLoading")}</p> : rings.length === 0 ? (
        <p className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">{t("hublessons.rgNonePlaced")}</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
          {rings.map((r) => (
            <li key={r.g} data-testid={canEdit ? undefined : `hub-journey-orb-${r.g}`} className="grid justify-items-center gap-1 rounded-2xl p-3 text-center"
              style={canEdit ? { background: "var(--panel)" } : { background: subjectSwatch(groupLabel(r.g, t)).bg, border: `1.5px solid ${subjectSwatch(groupLabel(r.g, t)).ring}` }}>
              {canEdit ? (
              <Ring pct={r.pct} count={r.count} label={r.count !== undefined ? t("hublessons.rgAriaCount", { n: r.count, group: groupLabel(r.g, t) }) : canEdit ? t("hublessons.rgAriaCovered", { pct: r.pct, group: groupLabel(r.g, t) }) : t("hublessons.rgAriaStarted", { pct: r.pct, group: groupLabel(r.g, t) })} size={78} />
              ) : (
                <GlassOrb pct={r.pct > 0 ? r.pct : null} color={subjectSwatch(groupLabel(r.g, t)).base} size={96} index={rings.indexOf(r)} aria={`${groupLabel(r.g, t)}: ${Math.round(r.pct)}%`}
                  center={r.pct > 0 ? <span className="text-[26px] leading-none">🗺️</span> : undefined} />
              )}
              <b className="text-[13.5px] text-[var(--ink)]">{groupLabel(r.g, t)}</b>
              <span className="text-[11.5px] font-semibold text-[var(--ink-2)]" aria-hidden={!canEdit || undefined}>{r.line}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
