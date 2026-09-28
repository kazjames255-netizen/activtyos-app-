"use client";

import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui";
import { Ico } from "../teachIcons";
import { FOCUS, fmtDay, relDay } from "../teachKit";
import type { IpSession } from "../inperson/api";

// A row for an in-person session inside the merged Lessons area's list — the same list video LessonRow entries sit
// in, styled to match, but plainer: an in-person session has no join window, no video, no reschedule, just who was
// there and (for one still open) a way back in. Read-only for everyone but the tutor who ran it (the server already
// enforces that; this row is never shown to a view-only role — see LiveLessonsPanel).

export function InPersonRow({ session, now, onResume }: { session: IpSession; now: number; onResume?: () => void }) {
  const t = useT();
  const live = session.status === "live";
  const here = session.students.filter((s) => s.present);
  return (
    <div data-ui="card" data-ip-session-id={session.id} data-status={session.status}
      className={`relative rounded-2xl border bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)] ${live ? "border-[var(--gold-line)]" : "border-[var(--line)]"}`}>
      {live && <span aria-hidden className="absolute bottom-3 start-0 top-3 w-[3px] rounded-e bg-[var(--gold)]" />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <span aria-hidden className="grid h-[58px] w-[58px] flex-none place-items-center rounded-2xl bg-[var(--panel)] text-[var(--ink-2)]"><Ico name="users" size={26} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 truncate text-[15px] font-extrabold text-[var(--ink)]">{session.title}</span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] font-extrabold" style={live ? { background: "var(--gold-soft)", color: "var(--brand-ink)", borderColor: "var(--gold-line)" } : { background: "var(--panel)", color: "var(--ink-2)", borderColor: "var(--line)" }}>
                {live && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full motion-reduce:animate-none" style={{ background: "var(--gold)" }} />}
                {live ? t("hublive.aIp_stillOpen") : t("hublive.aIp_ended")}
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-[3px] text-[11px] font-extrabold text-[var(--ink-2)]"><Ico name="users" size={12} />{t("hublive.aIp_inPerson")}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-[var(--ink-2)]">
              <span className="inline-flex items-center gap-1"><Ico name="calendar" size={13} className="text-[var(--ink-3)]" />{live ? relDay(session.startsAt, now) : fmtDay(session.startsAt)}</span>
              <span>{t("hublive.aIp_attendedCount", { a: here.length, b: session.students.length })}</span>
            </div>
          </div>
        </div>
        {live && onResume && (
          <Button variant="solid" className={`min-h-[44px] flex-none ${FOCUS}`} data-testid={`ip-resume-row-${session.id}`} onClick={onResume}>{t("hublive.aIp_resume")}</Button>
        )}
      </div>
    </div>
  );
}
