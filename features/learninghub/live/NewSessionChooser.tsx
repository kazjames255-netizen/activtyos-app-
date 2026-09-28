"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { Dialog, FOCUS, Segmented } from "../teachKit";

// The ONE "New session" entry point for the merged Lessons area (Kaz: "at some point they simply A) choose to go
// live now or schedule a lesson and B) choose a video lesson or non video lesson"). Two independent choices, then
// this hands off to whichever existing flow already does the real work — LessonForm (video, or in person scheduled
// for later: POST /lessons {mode:"in_person"}) or InPersonApp (in person, starting right now). Both ways of
// teaching can be started now or scheduled for later.

export type SessionWhen = "now" | "later";
export type SessionHow = "video" | "in_person";

export function NewSessionChooser({ onChoose, onClose }: {
  onChoose: (when: SessionWhen, how: SessionHow) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [how, setHow] = useState<SessionHow>("video");
  const [when, setWhen] = useState<SessionWhen>("later");

  return (
    <Dialog id="hub-new-session" title={t("hublive.aNew_title")} subtitle={t("hublive.aNew_subtitle")} onClose={onClose}
      footer={<>
        <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={onClose}>{t("hublive.aForm_cancel")}</Button>
        <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} data-testid="hub-new-session-continue" onClick={() => onChoose(when, how)}>{t("hublive.aNew_continue")}</Button>
      </>}>
      <div className="grid gap-5">
        <section aria-labelledby="hub-new-how">
          <h3 id="hub-new-how" className="m-0 mb-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{t("hublive.aNew_howLabel")}</h3>
          <Segmented label={t("hublive.aNew_howLabel")} value={how} onChange={setHow} options={[
            { v: "video", label: t("hublive.aNew_howVideo") },
            { v: "in_person", label: t("hublive.aNew_howInPerson") },
          ]} />
          <p className="mt-1.5 text-[12.5px] text-[var(--ink-3)]">{how === "video" ? t("hublive.aNew_howVideoHint") : t("hublive.aNew_howInPersonHint")}</p>
        </section>
        <section aria-labelledby="hub-new-when">
          <h3 id="hub-new-when" className="m-0 mb-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{t("hublive.aNew_whenLabel")}</h3>
          <Segmented label={t("hublive.aNew_whenLabel")} value={when} onChange={setWhen} options={[
            { v: "now", label: t("hublive.aNew_whenNow") },
            { v: "later", label: t("hublive.aNew_whenLater") },
          ]} />
        </section>
      </div>
    </Dialog>
  );
}
