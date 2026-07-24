"use client";

import { useEffect, useState } from "react";
import { useBookingsStore } from "./store";
import { Button, FieldLabel, Input } from "@/components/ui";

/** Compose to the selected bookings' families. Delivered as a Messages
 * broadcast — each family gets it in their thread (and by email), and their
 * reply lands back in the operator's Messages. */
export function BulkEmailModal() {
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
          Message {n} famil{n === 1 ? "y" : "ies"}
        </div>
        <div className="mb-3 text-[12px] text-[var(--ink-3)]">
          {compose.names.slice(0, 6).join(", ")}
          {n > 6 ? ` and ${n - 6} more` : ""} — sent to their Messages inbox and email. Replies come back to your
          Messages.
        </div>
        <FieldLabel>Subject (optional)</FieldLabel>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Change to Friday's pickup" className="mb-2.5 w-full" />
        <FieldLabel>Message</FieldLabel>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="Write to the families…"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]"
        />
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button onClick={emailClose}>Cancel</Button>
          <Button variant="primary" disabled={sending || !body.trim()} onClick={() => void sendBulkEmail(subject, body)}>
            {sending ? "Sending…" : `Send to ${n}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
