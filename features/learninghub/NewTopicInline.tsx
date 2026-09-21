"use client";

import { useCallback, useMemo, useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import { post } from "@/lib/api";
import { FOCUS } from "./kit";
import { errMsg, type Topic } from "./types";

// "+ New subject" / "+ New topic" beside any subject or topic picker. Creates through the SAME endpoint the
// sidebar (TopicFilter) uses — POST /api/learning-hub/topics — so the server's rules (a subject can't be
// split by casing, no duplicate topics, franchise scope) apply unchanged; its error message is shown as is.
// A subject only exists through its topics, so "new subject" creates the subject with its first topic.

/** POST /topics: a top-level topic {subject, topic}; the subject comes into being with its first topic. */
export const createHubTopic = (qs: string, body: { subject: string; topic: string }) => post<Topic>(`/api/learning-hub/topics${qs}`, body);

/** The panel's topics plus any created here that the realtime refetch hasn't delivered yet, so a form can select a new
 *  topic the instant it exists. `remember` records one. */
export function useTopicsWithNew(topics: Topic[]): [Topic[], (t: Topic) => void, (subject: string) => void] {
  const [added, setAdded] = useState<Topic[]>([]);
  const [gone, setGone] = useState<string[]>([]);
  const remember = useCallback((t: Topic) => {
    setAdded((cur) => (cur.some((x) => x.id === t.id) ? cur : [...cur, t]));
    setGone((cur) => cur.filter((s) => s.toLowerCase() !== t.subject.toLowerCase()));
  }, []);
  /** A subject deleted here disappears at once, before the realtime refetch lands. */
  const forgetSubject = useCallback((subject: string) => {
    setAdded((cur) => cur.filter((t) => t.subject.toLowerCase() !== subject.toLowerCase()));
    setGone((cur) => [...cur, subject.toLowerCase()]);
  }, []);
  const merged = useMemo(() => {
    const have = new Set(topics.map((t) => t.id));
    const extra = added.filter((t) => !have.has(t.id));
    const all = extra.length ? [...topics, ...extra] : topics;
    return gone.length ? all.filter((t) => !gone.includes(t.subject.toLowerCase())) : all;
  }, [topics, added, gone]);
  return [merged, remember, forgetSubject];
}

/** POST /topics/delete-subject: removes an EMPTY subject (all its topics); the server refuses (409) while any lesson/quiz/card is filed under it. */
export const deleteHubSubject = (qs: string, subject: string) => post<{ ok: true; deleted: number }>(`/api/learning-hub/topics/delete-subject${qs}`, { subject });

type Kind = "subject" | "topic";

interface Props {
  qs: string;
  /** Every topic the caller can see (incl. ones just created here). */
  topics: Topic[];
  /** The subject currently chosen in the form, if any — "new topic" defaults to it. */
  subject?: string;
  /** Called once the API has created the row. `kind` is which action made it. */
  onCreated: (t: Topic, kind: Kind) => void;
  /** Only "tutor mode with write access" callers get the actions. Default true. */
  canCreate?: boolean;
  /** Offer just one of the two actions. */
  only?: Kind;
  /** data-testid stem (default "new-topic"). */
  testId?: string;
  className?: string;
}

const linkBtn = `inline-flex min-h-[32px] items-center gap-1 rounded-full px-2 text-[12px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`;

export function NewTopicInline({ qs, topics, subject, onCreated, canCreate = true, only, testId = "new-topic", className = "" }: Props) {
  const [open, setOpen] = useState<Kind | null>(null);
  const [subj, setSubj] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const subjects = useMemo(() => [...new Set(topics.map((t) => t.subject))].sort((a, b) => a.localeCompare(b)), [topics]);
  if (!canCreate) return null;

  const show = (k: Kind) => { setOpen(k); setErr(null); setName(""); setSubj(k === "topic" ? subject || subjects[0] || "" : ""); };
  const close = () => { setOpen(null); setErr(null); };

  const save = async () => {
    const n = name.trim(), s = subj.trim();
    if (open === "subject") {
      if (!n) { setErr("Give the subject a name."); return; }
      const dup = subjects.find((x) => x.toLowerCase() === n.toLowerCase());
      if (dup) { setErr(`“${dup}” already exists — choose it from the list.`); return; }
    } else if (!s || !n) { setErr(s ? "Give the topic a name." : "Pick a subject first."); return; }
    setBusy(true); setErr(null);
    try {
      // A new subject starts with a "General" topic (the subject can't exist without one); the name field is the subject.
      const t = open === "subject" ? await createHubTopic(qs, { subject: n, topic: "General" }) : await createHubTopic(qs, { subject: s, topic: n });
      onCreated(t, open!);
      setOpen(null); setName("");
    } catch (e) { setErr(errMsg(e, "Couldn't add that")); }
    finally { setBusy(false); }
  };

  return (
    <div className={className} data-testid={testId}>
      <div className="flex flex-wrap items-center gap-x-1">
        {only !== "topic" && <button type="button" className={linkBtn} data-testid={`${testId}-subject-btn`} onClick={() => (open === "subject" ? close() : show("subject"))}>+ New subject</button>}
        {only !== "subject" && subjects.length > 0 && <button type="button" className={linkBtn} data-testid={`${testId}-topic-btn`} onClick={() => (open === "topic" ? close() : show("topic"))}>+ New topic</button>}
      </div>
      {open && (
        <div role="group" aria-label={open === "subject" ? "New subject" : "New topic"} data-testid={`${testId}-form`}
          className="mt-1.5 grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5"
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } else if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); e.stopPropagation(); void save(); } }}>
          {open === "topic" && (
            <Select aria-label="Subject for the new topic" data-testid={`${testId}-subject-select`} value={subj} onChange={(e) => setSubj(e.target.value)} className="min-h-[40px] w-full">
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          )}
          <Input aria-label={open === "subject" ? "New subject name" : "New topic name"} data-testid={`${testId}-name`} data-autofocus autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={open === "subject" ? 80 : 120}
            placeholder={open === "subject" ? "Subject name (e.g. Geography)" : "Topic name (e.g. Algebra)"} className="min-h-[40px] w-full" />
          {open === "subject" && <p className="m-0 text-[11.5px] text-[var(--ink-3)]">The subject is created with a first topic called &ldquo;General&rdquo; — add more topics any time.</p>}
          {err && <p role="alert" data-testid={`${testId}-err`} className="m-0 text-[12.5px] font-bold text-[var(--red)]">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" sm variant="ghost" onClick={close}>Cancel</Button>
            <Button type="button" sm variant="solid" disabled={busy} data-testid={`${testId}-save`} onClick={() => void save()}>{busy ? "Adding…" : open === "subject" ? "Add subject" : "Add topic"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
