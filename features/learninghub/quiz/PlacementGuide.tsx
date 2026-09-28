"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "../kit";
import { display } from "../shared-assess/ui";
import { useHubI18n } from "../family/hubT";

// "How placement works" — the three-step story a tutor needs before publishing a
// placement test. A numbered rail joins the steps (horizontal on desktop, vertical
// on a phone); purely explanatory.

const ICONS: IconName[] = ["quiz", "compass", "chart"];

export function PlacementGuide({ requireDiagnostic }: { requireDiagnostic: boolean }) {
  const { t } = useHubI18n();
  // Open/Close, remembered per device (read after mount so server and client markup match).
  const [open, setOpen] = useState(true);
  useEffect(() => { try { if (localStorage.getItem("hub.placementGuide.open") === "0") setOpen(false); } catch { /* private mode */ } }, []);
  const toggle = () => setOpen((o) => { const n = !o; try { localStorage.setItem("hub.placementGuide.open", n ? "1" : "0"); } catch { /* ignore */ } return n; });
  const STEPS = [
    { icon: ICONS[0]!, title: t("hubfam.qzPgS1T"), body: t("hubfam.qzPgS1B") },
    { icon: ICONS[1]!, title: t("hubfam.qzPgS2T"), body: t("hubfam.qzPgS2B") },
    { icon: ICONS[2]!, title: t("hubfam.qzPgS3T"), body: requireDiagnostic ? t("hubfam.qzPgS3BLock") : t("hubfam.qzPgS3B") },
  ];
  return (
    <section aria-label={t("hubfam.qzPgHow")} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5" data-testid="hub-placement-guide">
      <div className="flex items-center justify-between gap-3">
        <h4 className="m-0 text-[14px] font-extrabold text-[var(--ink)]" style={display}>{t("hubfam.qzPgHow")}</h4>
        <button type="button" data-testid="hub-placement-guide-toggle" aria-expanded={open} aria-controls="hub-placement-guide-steps" onClick={toggle}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-[12px] font-extrabold text-[var(--brand-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">
          {open ? t("hubfam.qzPgClose") : t("hubfam.qzPgOpen")} <span aria-hidden>{open ? "▲" : "▼"}</span>
        </button>
      </div>
      <ol id="hub-placement-guide-steps" hidden={!open} className="m-0 mt-4 grid list-none gap-5 p-0 sm:grid-cols-3 sm:gap-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative flex gap-3.5 sm:block">
            {i < STEPS.length - 1 && (
              <>
                <span aria-hidden className="absolute start-[19px] top-11 h-[calc(100%-8px)] w-0 border-s-2 border-dashed border-[var(--brand-line)] sm:hidden" />
                <span aria-hidden className="absolute start-12 end-[-8px] top-[19px] hidden border-t-2 border-dashed border-[var(--brand-line)] sm:block" />
              </>
            )}
            <span className="relative z-[1] grid h-10 w-10 flex-none place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)] ring-4 ring-[var(--surface)]" aria-hidden><Icon name={s.icon} size={19} strokeWidth={1.8} /></span>
            <div className="min-w-0 sm:mt-3">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--ink-3)]">{t("hubfam.qzPgStep", { n: i + 1 })}</div>
              <div className="mt-0.5 text-[14px] font-extrabold leading-snug text-[var(--ink)]" style={display}>{s.title}</div>
              <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-[var(--ink-2)]">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
