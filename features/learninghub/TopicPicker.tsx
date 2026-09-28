"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui";
import { deleteHubSubject } from "./NewTopicInline";
import { errMsg } from "./types";
import { useT } from "@/lib/i18n/provider";
import { FOCUS, subjectColor, subjectInk, tint } from "./kit";
import type { Topic } from "./types";

// Subject first, then a search bar with the topic names listed right under it — no dropdown to scroll.
// Replaces the plain <select> of every "Subject › Topic › Subtopic" in the lesson editor.

const topicName = (t: Topic) => [t.topic, t.subtopic].filter(Boolean).join(" › ");

export function TopicPicker({ id, topics, value, onChange, disabled = false, deleteSubject, fresh = false }: {
  id: string; topics: Topic[]; value: string; onChange: (topicId: string) => void; disabled?: boolean;
  /** Making something NEW: do not pre-list every existing topic (they are curriculum unit / lesson names, so the list reads as a wall of existing titles). Only the chosen topic shows until the tutor types to search or adds a new one. */
  fresh?: boolean;
  /** Tutors with write access can delete an empty subject; omit to hide the button. `done` runs once the server has removed it. */
  deleteSubject?: { qs: string; done: (subject: string) => void };
}) {
  const tr = useT();
  const selected = topics.find((t) => t.id === value);
  const subjects = useMemo(() => [...new Set(topics.map((t) => t.subject))].sort((a, b) => a.localeCompare(b)), [topics]);
  const [picked, setPicked] = useState<string | null>(null);
  const subject = picked ?? selected?.subject ?? subjects[0] ?? "";
  const [q, setQ] = useState("");
  const [delErr, setDelErr] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  // a topic chosen elsewhere (e.g. just created under another subject) pulls the subject tabs with it
  useEffect(() => { if (selected) setPicked(selected.subject); }, [selected?.id, selected?.subject]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (fresh && !needle) return topics.filter((t) => t.id === value && t.subject === subject);
    return topics
      .filter((t) => t.subject === subject && (!needle || topicName(t).toLowerCase().includes(needle)))
      .sort((a, b) => topicName(a).localeCompare(topicName(b)));
  }, [topics, subject, q, fresh, value]);
  const inSubject = useMemo(() => topics.filter((t) => t.subject === subject).length, [topics, subject]);

  const removeSubject = async () => {
    if (!deleteSubject) return;
    setBusy(true); setDelErr(null);
    try { await deleteHubSubject(deleteSubject.qs, subject); setAsking(false); setPicked(null); setQ(""); deleteSubject.done(subject); }
    catch (e) { setDelErr(errMsg(e, tr("hubshell.k_deleteSubjectFail"))); setAsking(false); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-2.5">
      <div role="group" aria-label={tr("hubshell.k_subject")} className="flex flex-wrap gap-1.5" data-testid={`${id}-subjects`}>
        {subjects.map((s) => {
          const on = s === subject;
          const c = subjectColor(s);
          return (
            <button key={s} type="button" disabled={disabled} aria-pressed={on} onClick={() => { setPicked(s); setQ(""); setDelErr(null); setAsking(false); }}
              className={`min-h-[44px] lg:min-h-[36px] rounded-full border px-3.5 text-[13px] font-bold transition ${FOCUS}`}
              style={on ? { background: tint(c, 18), borderColor: c, color: subjectInk(s) } : { background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink-2)" }}>
              {s}
            </button>
          );
        })}
      </div>
      {deleteSubject && subject && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          {asking ? (
            <>
              <span className="text-[var(--ink-2)]">{tr("hubshell.k_deleteEmptyQ", { subject })}</span>
              <button type="button" disabled={busy} data-testid={`${id}-delete-confirm`} onClick={() => void removeSubject()} className={`min-h-[32px] rounded-full px-3 font-extrabold text-[var(--red)] hover:underline ${FOCUS}`}>{busy ? tr("hubshell.k_deleting") : tr("hubshell.k_yesDelete")}</button>
              <button type="button" onClick={() => setAsking(false)} className={`min-h-[32px] rounded-full px-3 font-bold text-[var(--ink-3)] hover:underline ${FOCUS}`}>{tr("hubshell.k_cancel")}</button>
            </>
          ) : (
            <button type="button" data-testid={`${id}-delete-subject`} onClick={() => { setAsking(true); setDelErr(null); }} className={`min-h-[32px] rounded-full px-2 font-bold text-[var(--ink-3)] hover:text-[var(--red)] hover:underline ${FOCUS}`}>{tr("hubshell.k_deleteSubject", { subject })}</button>
          )}
          {delErr && <span role="alert" data-testid={`${id}-delete-err`} className="font-bold text-[var(--red)]">{delErr}</span>}
        </div>
      )}
      <Input type="search" aria-label={tr("hubshell.k_searchTopicsIn", { subject })} placeholder={subject ? tr("hubshell.k_searchIn", { subject }) : tr("hubshell.k_searchTopicsPh")} value={q} disabled={disabled} onChange={(e) => setQ(e.target.value)}
        className="min-h-[44px] w-full" data-testid={`${id}-search`} />
      <div id={id} role="listbox" aria-label={tr("hubshell.k_subjectTopics", { subject })} data-testid={`${id}-list`}
        className="max-h-[248px] overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1">
        {rows.length === 0 ? (
          <p className="m-0 px-3 py-3 text-[13px] text-[var(--ink-3)]">{fresh && !q.trim() ? tr("hubshell.k_typeToFindTopic") : inSubject ? tr("hubshell.k_noTopicMatches", { subject, q: q.trim() }) : tr("hubshell.k_noTopicsYet")}</p>
        ) : rows.map((t) => {
          const on = t.id === value;
          return (
            <button key={t.id} type="button" role="option" aria-selected={on} disabled={disabled} onClick={() => onChange(t.id)}
              className={`flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-start text-[14px] transition ${FOCUS} ${on ? "font-extrabold" : "font-medium hover:bg-[var(--panel)]"}`}
              style={on ? { background: tint(subjectColor(t.subject), 16), color: subjectInk(t.subject) } : { color: "var(--ink)" }}>
              <span className="min-w-0 flex-1">{topicName(t)}</span>
              {on && <span aria-hidden="true" className="text-[13px]">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
