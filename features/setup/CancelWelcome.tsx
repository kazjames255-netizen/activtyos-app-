"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { useI18n, useT } from "@/lib/i18n/provider";
import { portalOf } from "@/lib/portal-href";
import { useFirstRunSteps } from "@/features/dashboard/useFirstRunSteps";
import { policyWordingT, sortBands, noticeLabelT, type NamedPolicy } from "@/lib/cancellation";

/** First visit to Cancellations & refunds from the set-up checklist: instead of the full editor, say which common policy was chosen,
 *  show it in plain words, and let them keep it and move on (or open the editor). The checklist step counts as done either way. */
export function CancelWelcome({ policy, onEdit }: { policy: NamedPolicy; onEdit: () => void }) {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const portal = portalOf(usePathname());
  const fr = useFirstRunSteps();
  const bands = sortBands(policy.bands);
  const keep = () => {
    fr.markVisited("cancel");
    const next = fr.steps.find((s) => !s.done && s.id !== "cancel");
    router.push(next ? next.href : `/${portal}`);
  };
  const tone = (pct: number) => (pct >= 100 ? { bg: "#e7f6ee", fg: "#0f7a43" } : pct > 0 ? { bg: "#fdf3d8", fg: "#9a5a00" } : { bg: "#fdebec", fg: "#bb1620" });
  return (
    <Card className="p-5 sm:p-6" data-testid="cancel-welcome">
      <div className="text-[22px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{t("p9fr.cwTitle")}</div>
      <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-[var(--ink-2)]">{t("p9fr.cwIntro")}</p>
      <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{policy.name}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {bands.map((b, i) => {
            const c = tone(b.refundPercent);
            const label = b.hoursBefore > 0 ? noticeLabelT(t, locale, b.hoursBefore) : null;
            return (
              <span key={i} className="rounded-full px-3 py-1.5 text-[14px] font-bold" style={{ background: c.bg, color: c.fg }}>
                {label ? t("p8set.polBand", { label, pct: b.refundPercent }) : `${b.refundPercent}%`}
              </span>
            );
          })}
        </div>
        <p className="mt-3 mb-0 text-[14px] leading-relaxed text-[var(--ink-2)]">{policyWordingT(t, locale, { ...policy, wording: undefined })}</p>
      </div>
      <p className="mt-3 text-[14px] text-[var(--ink-2)]">{t("p9fr.cwChange")}</p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <Button variant="primary" onClick={keep} className="!min-h-[46px] !px-6 !text-[15px]">{t("p9fr.cwKeep")}</Button>
        <Button onClick={onEdit} className="!min-h-[46px] !px-5 !text-[15px]">{t("p9fr.cwEdit")}</Button>
      </div>
    </Card>
  );
}
