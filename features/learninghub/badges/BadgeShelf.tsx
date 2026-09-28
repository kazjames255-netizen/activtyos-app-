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

export function BadgeShelf({ qs, childId, name, yearGroup, kid }: { qs: string; childId: string; name: string; yearGroup?: string | null; kid: boolean }) {
  const t = useT();
  const calm = useSupport().calm;
  const band = bandOfYear(yearGroup);
  const hidden = kid && (calm || band === "ks1");
  const [data, setData] = useState<BadgesOut | null>(null);
  const [fresh, setFresh] = useState<BadgeId[]>([]);
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
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="m-0 text-[15px] font-extrabold text-[var(--ink)]">{title}</h3>
        <span className="text-[12px] font-bold text-[var(--ink-3)]" data-testid="hub-badges-count">{t("hubextras.bd_count", { n: data.earned, total: data.total })}</span>
      </div>
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4">
        {data.badges.map((b) => (
          <li key={b.id} data-testid={`hub-badge-${b.id}`} data-earned={b.earned ? "1" : "0"} title={t(`hubextras.bd_${b.id}_d`)}
            className={`grid content-start justify-items-center gap-1 rounded-2xl border p-3 text-center ${b.earned ? "border-[var(--gold)] bg-[var(--gold-soft)]" : "border-[var(--line)] bg-[var(--panel)] opacity-70"}`}>
            <span aria-hidden className={`text-[30px] ${b.earned ? "" : "grayscale"}`}>{ICON[b.id]}</span>
            <span className="text-[12.5px] font-extrabold leading-tight text-[var(--ink)]">{nm(b.id)}</span>
            <span className="text-[11px] leading-snug text-[var(--ink-2)]">{t(`hubextras.bd_${b.id}_d`)}</span>
            {!b.earned && b.need ? <span className="text-[11px] font-bold text-[var(--ink-3)]">{t("hubextras.bd_progress", { have: b.have ?? 0, need: b.need })}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
