"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { post } from "@/lib/api";
import { Icon } from "../kit";
import type { PanelProps } from "../panelTypes";
import { errMsg } from "../types";
import { hubPath } from "../shared-assess/api";
import { display, Modal, Notice, TAP } from "../shared-assess/ui";
import { useHubI18n } from "../family/hubT";

const SEL = "min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[13.5px] text-[var(--ink)] outline-none focus:border-[var(--brand)]";

/** Renders `text` with the first occurrence of `name` in bold (no word-order assumption). */
function boldName(text: string, name: string) {
  const i = text.indexOf(name);
  if (i < 0) return text;
  return <>{text.slice(0, i)}<b className="text-[var(--ink)]">{name}</b>{text.slice(i + name.length)}</>;
}

/** Let a tutor skip the placement test for one student in one subject — a labelled
 *  form with a plain-English explanation and a confirm step. */
export function WaiveCard({ p, diagSubjects }: { p: PanelProps; /** Subjects that have a placement test (the list's subject facet). */ diagSubjects: string[] }) {
  const { t } = useHubI18n();
  const subjects = [...new Set([...p.topics.map((tp) => tp.subject), ...diagSubjects])].sort();
  const [childId, setChildId] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const active = p.students.filter((s) => s.active !== false);
  if (!active.length || !subjects.length) return null;
  const name = active.find((s) => s.childId === childId)?.childName ?? t("hubfam.qzThisStudent");
  const ready = !!childId && !!subject;

  const go = async () => {
    setBusy(true); setDone(null);
    try {
      await post(hubPath(p.qs, `/students/${childId}/diagnostic-waive`), { subject });
      setDone(t("hubfam.qzWaiveDone", { name, subject }));
      setAsk(false); setChildId(""); setSubject("");
    } catch (e) { setAsk(false); p.onError(errMsg(e, t("hubfam.qzWaiveFail"))); }
    finally { setBusy(false); }
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-1 gap-3.5">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[var(--gold-soft)]" style={{ color: "color-mix(in srgb, var(--gold) 35%, var(--ink))" }} aria-hidden><Icon name="play" size={20} /></span>
          <div className="min-w-0">
            <h4 className="m-0 text-[15px] font-extrabold text-[var(--ink)]" style={display}>{t("hubfam.qzWaiveTitle")}</h4>
            <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-[var(--ink-2)]">{t("hubfam.qzWaiveBody")}</p>
          </div>
        </div>
        <div className="w-full flex-none lg:w-[420px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{t("hubfam.qzStudent")}
              <select value={childId} onChange={(e) => setChildId(e.target.value)} className={`${SEL} normal-case tracking-normal font-semibold`}><option value="">{t("hubfam.qzChooseStudent")}</option>{active.map((s) => <option key={s.childId} value={s.childId}>{s.childName}</option>)}</select>
            </label>
            <label className="grid gap-1 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{t("hubfam.qzSubject")}
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className={`${SEL} normal-case tracking-normal font-semibold`}><option value="">{t("hubfam.qzChooseSubject")}</option>{subjects.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="solid" className={`${TAP} !px-5`} disabled={!ready || busy} onClick={() => setAsk(true)}>{t("hubfam.qzWaiveBtn")}</Button>
            {!ready && <span className="text-[12px] text-[var(--ink-3)]">{t("hubfam.qzWaiveChoose")}</span>}
          </div>
        </div>
      </div>
      {done && <div className="mt-3"><Notice tone="ok" onDismiss={() => setDone(null)}>{done}</Notice></div>}
      {ask && (
        <Modal title={t("hubfam.qzWaiveModalT")} onClose={() => setAsk(false)}
          footer={<><Button variant="ghost" className={TAP} onClick={() => setAsk(false)}>{t("hubfam.qzCancel")}</Button><Button variant="solid" className={TAP} disabled={busy} onClick={go} data-autofocus>{busy ? t("hubfam.qzWorking") : t("hubfam.qzWaiveYes")}</Button></>}>
          <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">{boldName(t("hubfam.qzWaiveModalBody", { name, subject }), name)}</p>
        </Modal>
      )}
    </Card>
  );
}
