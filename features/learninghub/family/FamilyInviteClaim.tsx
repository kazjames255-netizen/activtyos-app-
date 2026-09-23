"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { get, post } from "@/lib/api";
import { EmptyState, FOCUS, Skeleton } from "../kit";
import { errMsg } from "../types";

// F13 — a tutor sent this family a link (/custdash/learninghub?invite=…). They choose which of THEIR OWN children to enrol
// with that tutor; the server checks the child is on their account and creates the enrolment (POST /family-invites/:token/accept).

interface Preview { providerName: string; tutorName: string; forName: string; subjects: string[]; alreadyEnrolled: string[] }
interface Kid { id: string; name: string }

export function FamilyInviteClaim({ token, portal }: { token: string; portal: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [kids, setKids] = useState<Kid[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]); // child ids enrolled this visit

  useEffect(() => {
    let live = true;
    get<Preview>(`/api/learning-hub/family-invites/${encodeURIComponent(token)}`).then((p) => { if (live) setPreview(p); }).catch((e) => { if (live) setProblem(errMsg(e, "That invite link isn't valid.")); });
    get<Kid[]>("/api/my/children").then((k) => { if (live) setKids(Array.isArray(k) ? k : []); }).catch(() => { if (live) setKids([]); });
    return () => { live = false; };
  }, [token]);

  const enrol = async (k: Kid) => {
    setBusy(k.id); setProblem(null);
    try { await post(`/api/learning-hub/family-invites/${encodeURIComponent(token)}/accept`, { childId: k.id }); setDone((d) => [...d, k.id]); }
    catch (e) { setProblem(errMsg(e, "Couldn't enrol that child.")); }
    finally { setBusy(null); }
  };
  // Leaving = open the hub proper, without the invite in the URL (a full load so the sidebar picks up the new enrolment).
  const finish = () => window.location.assign(`/${portal}/learninghub`);

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={{ background: "var(--bg)", color: "var(--ink)" }} id="hub-family-invite-claim">
      <div className="mx-auto mt-6 max-w-[560px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
        {problem && !preview ? (
          <EmptyState icon="notes" title="This invite can't be used" body={problem} />
        ) : !preview || kids === null ? (
          <div role="status" aria-busy="true" aria-label="Checking your invite"><Skeleton className="h-6 w-2/3" /><Skeleton className="mt-3 h-4 w-full" /><Skeleton className="mt-6 h-11 w-full" /></div>
        ) : (
          <>
            <h1 className="m-0 text-[20px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Join {preview.providerName} on My Classroom</h1>
            <p className="mt-1.5 text-[13.5px] leading-snug text-[var(--ink-2)]">
              {preview.tutorName ? `${preview.tutorName} has` : "Your tutor has"} invited {preview.forName ? preview.forName : "your family"}{preview.subjects.length ? ` for ${preview.subjects.join(", ")}` : ""}. Choose which of your children to enrol — they will see this tutor&apos;s lessons, quizzes and live lessons.
            </p>
            {problem && <p role="alert" className="mt-3 rounded-xl border border-[var(--red-line)] bg-[var(--red-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--red)]">{problem}</p>}
            {kids.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] p-4 text-[13px] text-[var(--ink-2)]">
                You haven&apos;t added a child to your account yet. <Link href={`/${portal}/children`} className="font-extrabold text-[var(--brand)] underline">Add your child</Link>, then open your invite link again.
              </div>
            ) : (
              <ul className="mt-4 grid gap-2" aria-label="Your children">
                {kids.map((k) => {
                  const enrolled = done.includes(k.id) || (preview.alreadyEnrolled ?? []).includes(k.id);
                  return (
                    <li key={k.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-3 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[14px] font-extrabold">{k.name}</span>
                      {enrolled ? <span data-testid={`hub-invite-enrolled-${k.id}`} className="text-[12.5px] font-extrabold text-[var(--hub-green-ink)]">Enrolled</span>
                        : <button type="button" data-testid={`hub-invite-enrol-${k.id}`} disabled={busy !== null} onClick={() => void enrol(k)} className={`min-h-[44px] rounded-full px-5 text-[13px] font-extrabold text-white disabled:opacity-60 ${FOCUS}`} style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>{busy === k.id ? "Enrolling…" : "Enrol"}</button>}
                    </li>
                  );
                })}
              </ul>
            )}
            {done.length > 0 && <button type="button" onClick={finish} data-testid="hub-invite-open" className={`mt-4 min-h-[44px] rounded-full border border-[var(--line)] px-5 text-[13px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>Open My Classroom</button>}
          </>
        )}
      </div>
    </div>
  );
}
