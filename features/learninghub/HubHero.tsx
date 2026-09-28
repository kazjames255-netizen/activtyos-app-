"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { pluralOf } from "./home/homeI18n";
import { Select } from "@/components/ui";
import { ACT_C } from "@/features/money/finance-kit";
import { FOCUS, Icon, type IconName } from "./kit";
import HowItWorksButton from "./howitworks/HowItWorksButton";
import type { HubChild, HubProvider, NoteStats, Topic } from "./types";
import { subjectsOf } from "./types";

// The hub's header. Two shapes of the same banner:
//  • full  — Home only: the title, a lede and four stat tiles (foldable);
//  • compact — every other tab: a 64px bar (title, who/what, pickers) so the
//    content starts right under the tabs instead of ~300px down the page.
// Same navy→blue house gradient as PageHero, but with real 44px tap targets.

const OPERATOR_PORTALS = new Set(["company", "franchise", "freelancer"]);
const HERO_KEY = "aos.hero.learninghub";

interface Props {
  mode: "student" | "tutor";
  providers: HubProvider[];
  provider: HubProvider | null;
  onProvider: (id: string) => void;
  kids: HubChild[];
  childId: string | null;
  onChild: (id: string) => void;
  topics: Topic[];
  /** Note counts from GET /notes/counts (null until they arrive). */
  noteStats: NoteStats | null;
  activeStudents: number;
  ready: boolean;
  /** true on every tab except Home: the slim bar, no tiles. */
  compact?: boolean;
}

function Stat({ label, icon, color, value, sub }: { label: string; icon: IconName; color: string; value: string; sub?: ReactNode }) {
  return (
    <div className="hub-lift relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 ps-4 sm:p-4 sm:ps-[18px]">
      <div className="pointer-events-none absolute bottom-3 start-0 top-3 w-[3px] rounded-e" style={{ background: color }} />
      <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">
        <span className="grid h-6 w-6 flex-none place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${color} 12%, var(--surface))`, color }}><Icon name={icon} size={14} /></span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 truncate text-[24px] font-extrabold leading-none tabular-nums sm:text-[27px]" style={{ fontFamily: "var(--ff-display)", color }}>{value}</div>
      {sub && <div className="mt-1.5 truncate text-[11px] font-semibold text-[var(--ink-3)]">{sub}</div>}
    </div>
  );
}

export function HubHero({ mode, providers, provider, onProvider, kids, childId, onChild, topics, noteStats, activeStudents, ready, compact = false }: Props) {
  const { t, locale } = useI18n();
  const pl = (base: string, n: number) => pluralOf(t, locale, base, n);
  const portal = (usePathname() ?? "").split("/")[1] ?? "";
  const tutor = mode === "tutor";
  const childName = kids.find((c) => c.childId === childId)?.childName;
  const drafts = noteStats?.drafts ?? 0;
  const fresh = noteStats?.fresh ?? 0;
  // P-02: count only real lessons, and only subjects that have one (falls back to the old numbers on an older server).
  const lessonCount = noteStats?.lessons ?? noteStats?.total ?? 0;
  const subjectCount = noteStats?.lessonTopicIds
    ? new Set(topics.filter((t) => noteStats.lessonTopicIds!.includes(t.id)).map((t) => t.subject)).size
    : subjectsOf(topics).length;
  const noLessons = !tutor && lessonCount === 0 && subjectCount === 0; // parent/child: show nothing rather than "0 lessons · 0 subjects"
  const val = (n: number) => (ready ? String(n) : "–");

  // Tutors: tiles collapsed by default (the summary line stays); a saved choice ("1" shown / "0" hidden) wins.
  const [open, setOpen] = useState(!tutor);
  useEffect(() => { try { const v = localStorage.getItem(HERO_KEY); if (v === "0") setOpen(false); else if (v === "1") setOpen(true); } catch { /* private mode */ } }, []);
  const toggle = () => setOpen((o) => { const n = !o; try { localStorage.setItem(HERO_KEY, n ? "1" : "0"); } catch { /* ignore */ } return n; });

  const lede = tutor
    ? t("hubshell.hm_heroLedeTutor")
    : t(provider ? (childName ? "hubshell.hm_ledePBoth" : "hubshell.hm_ledePProv") : (childName ? "hubshell.hm_ledePChild" : "hubshell.hm_ledeP"), { provider: provider?.name ?? "", child: childName ?? "" });
  const who = tutor ? provider?.name : [provider?.name, childName].filter(Boolean).join(" · ");

  const settings = tutor && OPERATOR_PORTALS.has(portal) ? (
    <Link href={`/${portal}/setup?tab=hub&from=learninghub`} aria-label={t("hubshell.hm_hubSettings")} title={t("hubshell.hm_hubSettings")}
      className={`inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-white/25 px-3 text-[12px] font-bold text-white/95 backdrop-blur-sm transition hover:bg-white/15 ${FOCUS}`} style={{ background: "rgba(12,26,68,.35)" }}>
      <Icon name="gear" size={16} /><span className="hidden sm:inline">{t("hubshell.hm_settings")}</span>
    </Link>
  ) : null;

  const pickers = (
    <>
      {providers.length > 1 && (
        <Select value={provider?.tenantId ?? ""} onChange={(e) => onProvider(e.target.value)} aria-label={t("hubshell.hm_provider")} className={`!min-h-[44px] max-w-[46vw] sm:max-w-none !rounded-full !border-white/25 !bg-white/95 !px-3.5 !font-bold ${FOCUS}`}>
          {providers.map((p) => <option key={p.tenantId} value={p.tenantId}>{p.name}</option>)}
        </Select>
      )}
      {/* The child switcher pills/select are removed from here: with the Home tab's own "All children" overview as
          the one place to pick a child (Kaz: "remove... just have it on front page very simple"), a second switcher
          in the hero was one more way to do the same thing — exactly the kind of duplication he's been flagging. */}
      <HowItWorksButton role={tutor ? "tutor" : "parent"} />
      {settings}
    </>
  );

  const surface = {
    backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), var(--hero-grad)",
    backgroundSize: "18px 18px, cover, cover, cover, cover",
    backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat",
  } as const;

  if (compact) {
    return (
      <div className="op-hero relative mb-3 flex min-h-[64px] flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden rounded-2xl px-3.5 py-2.5 text-white shadow-[0_10px_30px_-14px_rgba(29,58,143,.55)] sm:px-4" style={surface} id="hub-hero-compact">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white/20"><Icon name="notes" size={18} /></span>
        <div className="min-w-0 flex-1 basis-[140px]">
          <h2 className="m-0 truncate text-[18px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{tutor ? t("hubshell.hm_hubName") : t("hubshell.hm_learningHub")}</h2>
          {who && <p className="m-0 truncate text-[12px] leading-tight text-white/80">{who}</p>}
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">{pickers}</div>
      </div>
    );
  }

  return (
    <>
      <div className="op-hero relative mb-3.5 overflow-hidden rounded-2xl p-4 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)] sm:p-5" style={surface}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="m-0 flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/20"><Icon name="notes" size={17} /></span>
              {tutor ? t("hubshell.hm_hubName") : t("hubshell.hm_learningHub")}
            </h2>
            <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-[1.5] text-white/85">{lede}</p>
            <p className="mt-1 text-[12.5px] font-bold text-white/95" data-testid="hub-hero-summary">
              {ready ? [tutor ? pl("hm_nStudents", activeStudents) : "", ...(noLessons ? [] : [pl("hm_nLessons", lessonCount), pl("hm_nSubjects", subjectCount)])].filter(Boolean).join(" · ") : t("hubshell.hm_loading")}
            </p>
          </div>
          <div className="flex flex-none flex-wrap items-center gap-2">
            {pickers}
            <button type="button" onClick={toggle} aria-expanded={open} title={open ? t("hubshell.hm_hideNumbers") : t("hubshell.hm_showNumbers")}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/20 px-3.5 text-[12px] font-bold text-white/90 backdrop-blur-sm transition hover:text-white lg:min-h-[36px] ${FOCUS}`}
              style={{ background: "rgba(12,26,68,.42)" }}>
              <Icon name="chevronDown" size={13} strokeWidth={2.4} className={`transition-transform ${open ? "" : "-rotate-90"}`} />{open ? t("hubshell.hm_hideNumbers") : t("hubshell.hm_showNumbers")}
            </button>
          </div>
        </div>
      </div>
      {open && !noLessons && (
        <div className="mb-3.5 -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&>*]:min-w-[156px] [&>*]:flex-1 [&>*]:snap-start lg:grid lg:grid-cols-3 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          <Stat label={t("hubshell.hm_statSubjects")} icon="layers" color={ACT_C[0]} value={val(subjectCount)} sub={ready ? t("hubshell.hm_withLessons") : undefined} />
          <Stat label={t("hubshell.hm_statLessons")} icon="notes" color={ACT_C[1]} value={noteStats ? val(lessonCount) : "–"} sub={tutor && drafts ? t("hubshell.hm_inDraft", { n: drafts }) : fresh ? t("hubshell.hm_newThisWeek", { n: fresh }) : undefined} />
          {tutor
            ? <Stat label={t("hubshell.hm_statStudents")} icon="users" color={ACT_C[3]} value={val(activeStudents)} sub={t("hubshell.hm_enrolledActive")} />
            : <Stat label={t("hubshell.hm_statLearningAs")} icon="sparkle" color={ACT_C[3]} value={childName?.split(" ")[0] ?? "–"} sub={provider?.name} />}
        </div>
      )}
    </>
  );
}
