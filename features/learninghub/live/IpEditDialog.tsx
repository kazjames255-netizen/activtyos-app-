"use client";

import { useState } from "react";
import { Button, FieldLabel, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { errMsg } from "../types";
import { Dialog, FOCUS, Notice } from "../teachKit";
import { editSession, type IpSession } from "../inperson/api";

// Rename an in-person lesson or fix its notes. Students and the time are not editable here (nor on the server) —
// a lesson that has started keeps who was there and when it ran.
export function IpEditDialog({ qs, session, onClose, onSaved }: { qs: string; session: IpSession; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const [title, setTitle] = useState(session.title);
  const [notes, setNotes] = useState(session.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const problem = !title.trim() ? t("hublive.aForm_needTitle") : null;
  const save = async () => {
    if (problem || busy) return;
    setBusy(true); setErr(null);
    try { await editSession(qs, session.id, { title: title.trim(), notes }); onSaved(); }
    catch (e) { setErr(errMsg(e, t("hublive.aForm_saveFail"))); setBusy(false); }
  };
  return (
    <Dialog id="hub-ip-edit" size="lg" title={t("hublive.aIp_editTitle")} subtitle={t("hublive.aIp_editHint")} onClose={onClose}
      footer={<>
        {problem && <span role="status" className="mr-auto self-center text-[13px] font-semibold text-[var(--danger,#b42318)]">{problem}</span>}
        <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={onClose}>{t("hublive.aForm_cancel")}</Button>
        <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} data-testid="hub-ip-edit-save" onClick={() => void save()} disabled={busy || !!problem}>{busy ? t("hublive.aForm_saving") : t("hublive.aForm_saveChanges")}</Button>
      </>}>
      <div className="grid gap-4">
        {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}
        <div>
          <FieldLabel htmlFor="hub-ip-edit-title">{t("hublive.aForm_title")}</FieldLabel>
          <Input id="hub-ip-edit-title" data-autofocus className="min-h-[44px] w-full" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </div>
        <div>
          <FieldLabel htmlFor="hub-ip-edit-notes">{t("hublive.aForm_msgLabel")}</FieldLabel>
          <textarea id="hub-ip-edit-notes" rows={4} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
        </div>
      </div>
    </Dialog>
  );
}
