"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { get } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { hubUrl } from "../home/homeLib";
import { bandOfYear } from "../family/kidCopy";
import { useSupport } from "../family/FamilyContext";
import { FOCUS } from "../kit";

// A child's badges (server: GET /badges, derived and read-only — lib/hubBadges.ts). The child's own device sees the shelf, and a
// "New badge!" card the first time a badge appears; a parent sees the same shelf, read-only and without the celebration.
// Hidden for a child whose tutor set CALM, and for KS1 (Reception – Year 2): no scores, streaks or targets for the youngest.

type BadgeId = "first_quiz" | "streak3" | "streak7" | "homework5" | "cards50" | "perfect" | "comeback";
interface BadgeRow { id: BadgeId; earned: boolean; have?: number; need?: number }
interface BadgesOut { badges: BadgeRow[]; earned: number; total: number }

const ICON: Record<BadgeId, string> = { first_quiz: "🎯", streak3: "🔥", streak7: "🌟", homework5: "📚", cards50: "🃏", perfect: "💯", comeback: "🚀" };
const seenKey = (childId: string) => `hub.badges.seen.v1.${childId}`;
const readSeen = (childId: string): string[] | null => { try { const r = localStorage.getItem(seenKey(childId)); return r ? (JSON.parse(r) as string[]) : null; } catch { return null; } };
const writeSeen = (childId: string, ids: string[]) => { try { localStorage.setItem(seenKey(childId), JSON.stringify(ids)); } catch { /* private mode: the card just shows again next visit */ } };

const MEDAL_CSS = `
.bsMedal{position:relative;display:grid;place-items:center;width:64px;height:64px;border-radius:9999px;overflow:hidden}
.bsMedal.on{background:radial-gradient(circle at 32% 26%,color-mix(in srgb,var(--gold) 35%,white),var(--gold) 55%,color-mix(in srgb,var(--gold) 70%,#6b4a00));box-shadow:inset 0 2px 3px rgba(255,255,255,.7),inset 0 -4px 6px rgba(0,0,0,.18),0 4px 10px color-mix(in srgb,var(--gold) 45%,transparent);border:3px solid color-mix(in srgb,var(--gold) 60%,white)}
.bsMedal.off{background:var(--surface);border:2.5px dashed var(--ink-3);opacity:.6}
.bsMedal.off .bsIcon{filter:grayscale(1) brightness(.55);opacity:.55}
.bsIcon{font-size:30px;line-height:1}
.bsMedal.on::after{content:"";position:absolute;inset:-20% auto -20% -60%;width:45%;transform:rotate(18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);opacity:0}
@media (prefers-reduced-motion: no-preference){
  .bsMedal.new::after{animation:bsShine 1.6s ease-out .3s 2 both}
  .bsMedal.new{animation:bsPop .7s cubic-bezier(.3,1.6,.5,1) both}
}
@keyframes bsShine{0%{left:-60%;opacity:1}100%{left:130%;opacity:1}}
@keyframes bsPop{from{transform:scale(.4)}to{transform:scale(1)}}
`;

export function BadgeShelf({ qs, childId, name, yearGroup, kid }: { qs: string; childId: string; name: string; yearGroup?: string | null; kid: boolean }) {
  const t = useT();
  const calm = useSupport().calm;
  const band = bandOfYear(yearGroup);
  const hidden = kid && (calm || band === "ks1");
  const [data, setData] = useState<BadgesOut | null>(null);
  const [fresh, setFresh] = useState<BadgeId[]>([]);
  const [open, setOpen] = useState(true);
  const seq = useRef(0);

  useEffect(() => {
    if (hidden) return;
    const mine = ++seq.current;
    get<BadgesOut>(hubUrl(qs, "/badges", { childId })).then((r) => {
      if (mine !== seq.current || !r || !Array.isArray(r.badges)) return;
      setData(r);
      if (!kid) return;
      const earned = r.badges.filter((b) => b.earned).map((b) => b.id);
      const seen = readSeen(childId);
      if (seen === null) { writeSeen(childId, earned); return; }            // first ever look: nothing is "new" yet
      const news = earned.filter((id) => !seen.includes(id));
      if (news.length) setFresh(news);
    }).catch(() => undefined);                                              // no shelf is better than an error on the home page
  }, [qs, childId, hidden, kid]);

  const dismiss = () => { if (data) writeSeen(childId, data.badges.filter((b) => b.earned).map((b) => b.id)); setFresh([]); };
  const title = useMemo(() => (kid ? t("hubextras.bd_title") : t("hubextras.bd_title_for", { name })), [kid, name, t]);
  if (hidden || !data) return null;
  const nm = (id: BadgeId) => t(`hubextras.bd_${id}`);

  return (
    <section aria-label={title} data-testid="hub-badges" data-earned={data.earned} className="grid gap-3 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
      {fresh.length > 0 && (
        <div role="status" data-testid="hub-badge-new" className="flex items-center gap-3 rounded-2xl border-2 border-[var(--gold)] bg-[var(--gold-soft)] p-3">
          <span aria-hidden className="text-[34px] motion-safe:animate-bounce">{ICON[fresh[0]]}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--ink-3)]">{t("hubextras.bd_new")}</div>
            <div className="text-[16px] font-extrabold text-[var(--ink)]">{fresh.map(nm).join(" · ")}</div>
          </div>
          <button type="button" onClick={dismiss} data-testid="hub-badge-new-close" className={`min-h-[44px] rounded-full bg-[var(--brand)] px-4 text-[13px] font-extrabold text-white ${FOCUS}`}>{t("hubextras.bd_nice")}</button>
        </div>
      )}
      <div className="flex items-baseline gap-2">
        <h3 className="m-0 text-[15px] font-extrabold text-[var(--ink)]">{title}</h3>
        <span className="ms-auto text-[12px] font-bold text-[var(--ink-3)]" data-testid="hub-badges-count">{t("hubextras.bd_count", { n: data.earned, total: data.total })}</span>
        <button type="button" data-testid="hub-badges-toggle" aria-expanded={open} aria-controls="hub-badges-list" onClick={() => setOpen((o) => !o)}
          className={`inline-flex min-h-[36px] items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-[12px] font-extrabold text-[var(--brand-strong)] ${FOCUS}`}>
          {open ? t("hubshell.hm_feedClose") : t("hubshell.hm_feedOpen")} <span aria-hidden>{open ? "▲" : "▼"}</span>
        </button>
      </div>
      <style>{MEDAL_CSS}</style>
      <ul id="hub-badges-list" hidden={!open} className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
        {data.badges.map((b) => {
          const isNew = fresh.includes(b.id);
          return (
            <li key={b.id} data-testid={`hub-badge-${b.id}`} data-earned={b.earned ? "1" : "0"} title={t(`hubextras.bd_${b.id}_d`)}
              className={`grid content-start justify-items-center gap-1.5 rounded-2xl border p-3 text-center transition motion-safe:hover:-translate-y-0.5 ${b.earned ? "border-[var(--gold)]" : "border-dashed border-[var(--line)]"}`}
              style={b.earned ? { background: "linear-gradient(160deg, color-mix(in srgb, var(--gold) 22%, var(--surface)), color-mix(in srgb, var(--gold) 6%, var(--surface)))" } : { background: "var(--panel)" }}>
              {/* a glossy MEDAL when earned (with a one-off shine sweep when it is new); a dim silhouette when still to earn */}
              <span aria-hidden className={`bsMedal ${b.earned ? "on" : "off"} ${isNew ? "new" : ""}`}>
                <span className="bsIcon">{ICON[b.id]}</span>
              </span>
              <span className="text-[12.5px] font-extrabold leading-tight text-[var(--ink)]">{nm(b.id)}</span>
              <span className={`text-[11px] leading-snug ${b.earned ? "text-[var(--ink-2)]" : "font-semibold text-[var(--ink-2)]"}`}>{t(`hubextras.bd_${b.id}_d`)}</span>
              {!b.earned && b.need ? <span className="text-[11px] font-bold text-[var(--ink-3)]">{t("hubextras.bd_progress", { have: b.have ?? 0, need: b.need })}</span> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
