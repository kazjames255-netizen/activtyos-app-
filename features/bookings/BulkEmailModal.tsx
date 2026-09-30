"use client";

import { useEffect, useState } from "react";
import { useBookingsStore } from "./store";
import { Button, FieldLabel, Input } from "@/components/ui";
import { useT, useI18n } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";

/** Compose to the selected bookings' families. Delivered as a Messages
 * broadcast — each family gets it in their thread (and by email), and their
 * reply lands back in the operator's Messages. */
export function BulkEmailModal() {
  const t = useT();
  const { locale } = useI18n();
  const compose = useBookingsStore((s) => s.emailCompose);
  const sending = useBookingsStore((s) => s.emailSending);
  const emailClose = useBookingsStore((s) => s.emailClose);
  const sendBulkEmail = useBookingsStore((s) => s.sendBulkEmail);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (compose) {
      setSubject("");
      setBody("");
    }
  }, [compose]);

  if (!compose) return null;
  const n = compose.emails.length;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/55 px-3.5 py-8" onClick={emailClose}>
      <div className="w-full max-w-[520px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 text-[15px] font-extrabold text-[var(--ink)]">
          {pickPlural(t, locale, "p8lst.beTitle", n)}
        </div>
        <div className="mb-3 text-[12px] text-[var(--ink-3)]">
          {compose.names.slice(0, 6).join(", ")}
          {n > 6 ? ` ${t("p8lst.beMore", { n: n - 6 })}` : ""} {t("p8lst.beSentTo")}
        </div>
        <FieldLabel>{t("p8lst.beSubject")}</FieldLabel>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("p8lst.beSubjectPh")} className="mb-2.5 w-full" />
        <FieldLabel>{t("p8lst.beMessage")}</FieldLabel>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder={t("p8lst.beMessagePh")}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]"
        />
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button onClick={emailClose}>{t("p8lst.bxCancel")}</Button>
          <Button variant="primary" disabled={sending || !body.trim()} onClick={() => void sendBulkEmail(subject, body)}>
            {sending ? t("p8lst.beSending") : t("p8lst.beSendTo", { n })}
          </Button>
        </div>
      </div>
    </div>
  );
}
