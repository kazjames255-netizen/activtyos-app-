"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { PanelProps } from "../panelTypes";
import { hubPath, type Mastery } from "../shared-assess/api";
import { useHubData } from "../shared-assess/hooks";
import { bandOfYear } from "../family/kidCopy";
import { kidBand } from "../family/KidMode";
import { useSupport } from "../family/FamilyContext";
import { subjectSwatch } from "../subjectColour";
import { FOCUS } from "../kit";
import { GlassOrb } from "../shared-ui/GlassOrb";

// A child's (and their parent's) subjects as glass ORBS: the liquid rises to how far the child has got in that subject, coloured by the
// subject. Kid-safe by design: levels are shown as emoji + a friendly word (🌱 Learning, 🌿 Developing, 🌳 Secure), a low score is a warm
// "still learning" seedling (never red), there is no comparison between children, and the child's own view hides the numbers for Reception–Year 2
// and for a calm child. At most five orbs show; "Show all" and an Open / Close toggle keep the page tidy.

const SHOW = 5;
const emojiOf = (pct: number) => (pct >= 80 ? "🌳" : pct >= 50 ? "🌿" : "🌱");
const defaultBand = (pct: number) => (pct >= 80 ? "Secure" : pct >= 50 ? "Developing" : "Learning");

export function SubjectOrbs({ p, childId, kid }: { p: PanelProps; childId: string; kid: boolean }) {
  const { t } = useI18n();
  const calm = useSupport().calm;
  const { data } = useHubData<Mastery>(hubPath(p.qs, "/mastery", { childId }), ["hubMastery", "hubAttempts"]);
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);
  const student = p.students.find((x) => x.childId === childId);
  const band = bandOfYear(student?.yearGroup);
  const showNumbers = !(kid && (calm || band === "ks1"));
  const subjects = data?.subjects ?? [];
  if (!data || subjects.length === 0) return null;
  // Started subjects first (highest first is a ranking of subjects, not of children — fine), unstarted ones last.
  const rows = [...subjects].sort((a, b) => (a.masteryPct == null ? 1 : 0) - (b.masteryPct == null ? 1 : 0) || a.subject.localeCompare(b.subject));
  const shown = all ? rows : rows.slice(0, SHOW);
  const name = (student?.childName ?? data.childName ?? "").split(" ")[0] ?? "";
  const title = kid || !name ? t("hubshell.kp_title") : t("hubshell.kp_titleFor", { name });

  return (
    <section aria-label={title} data-testid="hub-subject-orbs" className="grid gap-3 rounded-3xl border border-[var(--line)] p-4 shadow-[var(--shadow-sm)] sm:p-5"
      style={{ background: "linear-gradient(160deg, color-mix(in srgb, var(--brand) 9%, var(--surface)), color-mix(in srgb, var(--violet) 7%, var(--surface)) 55%, var(--surface))" }}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-[17px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{title}</h3>
        <button type="button" data-testid="hub-subject-orbs-toggle" aria-expanded={open} aria-controls="hub-subject-orbs-list" onClick={() => setOpen((o) => !o)}
          className={`inline-flex min-h-[40px] items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[12.5px] font-extrabold text-[var(--brand-strong)] ${FOCUS}`}>
          {open ? t("hubshell.hm_feedClose") : t("hubshell.hm_feedOpen")} <span aria-hidden>{open ? "▲" : "▼"}</span>
        </button>
      </div>
      <div id="hub-subject-orbs-list" hidden={!open} className="grid gap-3">
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((sb, i) => {
            const sw = subjectSwatch(sb.subject);
            const pct = sb.masteryPct;
            const has = pct != null;
            const word = has ? kidBand(sb.band ?? defaultBand(pct), kid) : t("hubshell.kp_notStarted");
            const level = has ? `${emojiOf(pct)} ${word}` : word;
            return (
              <li key={sb.subject} data-testid={`hub-orb-${sb.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} data-level={has ? defaultBand(pct).toLowerCase() : "none"}
                className="grid justify-items-center gap-2 rounded-2xl p-3 text-center transition motion-safe:hover:-translate-y-0.5"
                style={{ background: sw.bg, border: `1.5px solid ${sw.ring}` }}>
                <GlassOrb pct={has ? pct : null} color={sw.base} size={112} index={i} calm={calm}
                  aria={`${sb.subject}: ${level}${has && showNumbers ? `, ${Math.round(pct)}%` : ""}`}
                  center={has ? (
                    <span className="grid gap-0.5">
                      <span className="text-[30px] leading-none">{emojiOf(pct)}</span>
                      {showNumbers && <span className="text-[15px] font-extrabold leading-none" style={{ fontFamily: "var(--ff-display)" }}>{Math.round(pct)}%</span>}
                    </span>
                  ) : undefined} />
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-extrabold leading-tight" style={{ color: sw.fg, fontFamily: "var(--ff-display)" }}>{sb.subject}</div>
                  <div className="mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-extrabold" style={{ background: `color-mix(in srgb, ${sw.base} 22%, var(--surface))`, color: sw.fg }}>{level}</div>
                </div>
              </li>
            );
          })}
        </ul>
        {rows.length > SHOW && (
          <button type="button" data-testid="hub-subject-orbs-more" onClick={() => setAll((a) => !a)}
            className={`justify-self-start rounded-full px-3 py-2 text-[13px] font-extrabold text-[var(--brand-strong)] hover:underline ${FOCUS}`}>
            {all ? t("hubshell.hm_feedClose") : t("hubshell.kp_showAll", { n: rows.length })}
          </button>
        )}
      </div>
    </section>
  );
}
