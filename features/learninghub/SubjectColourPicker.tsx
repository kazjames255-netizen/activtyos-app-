"use client";

import { useEffect, useMemo, useState } from "react";
import { get, put } from "@/lib/api";
import { mergeHub, subjectColourKey, type HubSettings } from "@/lib/hubConfig";
import { FOCUS, Icon, Modal } from "./kit";
import { SubjectTile } from "./subjectArt";
import { SUBJECT_PALETTE, appliedSubjectColours, applySubjectColours, defaultColourKey, effectiveColourKey } from "./subjectColour";
import { errMsg } from "./types";

// Choosing the colour a subject wears across the whole hub. Two front doors share these pieces:
//   - the subject's ⋯ menu in the Subjects & topics tree  -> <SubjectColourModal>  (saves at once via PUT /api/learning-hub/config)
//   - Setup -> Teaching Hub                                -> <SubjectColoursEditor> (edits settings.hub.subjectColours in the Setup draft)
// The palette itself lives in subjectColour.ts; the server accepts only its keys.

/** The ten swatches as a radio group. `value` = the palette key in effect; `onPick(key)`. */
export function SwatchGrid({ subject, value, onPick, disabled }: { subject: string; value: string; onPick: (key: string) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={`Colour for ${subject}`} className="flex flex-wrap gap-2">
      {SUBJECT_PALETTE.map((p) => {
        const on = p.key === value;
        return (
          <button key={p.key} type="button" role="radio" aria-checked={on} aria-label={p.label} title={p.label} data-colour={p.key} disabled={disabled} onClick={() => onPick(p.key)}
            className={`grid h-11 w-11 flex-none place-items-center rounded-full border-2 text-white transition-transform hover:scale-105 disabled:opacity-50 ${FOCUS}`}
            style={{ background: p.base, borderColor: on ? "var(--ink)" : "transparent", boxShadow: on ? "0 0 0 2px var(--surface) inset" : undefined }}>
            {on ? <Icon name="check" size={18} strokeWidth={3} /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** ⋯ menu -> "Subject colour": pick one and it's saved to the hub and applied everywhere straight away. */
export function SubjectColourModal({ subject, qs, onClose, onSaved, onError }: { subject: string; qs: string; onClose: () => void; onSaved?: () => void; onError?: (msg: string) => void }) {
  const [chosen, setChosen] = useState<Record<string, string>>(() => appliedSubjectColours());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const value = effectiveColourKey(subject, chosen);
  const isDefault = !chosen[subjectColourKey(subject)];

  const save = async (next: Record<string, string>) => {
    if (busy) return;
    setBusy(true); setErr(null);
    const before = chosen;
    setChosen(next); applySubjectColours(next); // optimistic: the whole hub repaints under the dialog
    try {
      const r = await put<{ hub?: Partial<HubSettings> }>("/api/learning-hub/config" + qs, { hub: { subjectColours: next } });
      const saved = mergeHub(r?.hub).subjectColours;
      setChosen(saved); applySubjectColours(saved);
      onSaved?.();
    } catch (e) {
      setChosen(before); applySubjectColours(before);
      const m = errMsg(e, "Couldn't save that colour");
      setErr(m); onError?.(m);
    } finally { setBusy(false); }
  };
  const pick = (key: string) => {
    const k = subjectColourKey(subject);
    const next = { ...chosen };
    if (key === defaultColourKey(subject)) delete next[k]; else next[k] = key; // picking the default just clears the override
    void save(next);
  };
  const reset = () => { const next = { ...chosen }; delete next[subjectColourKey(subject)]; void save(next); };

  return (
    <Modal open onClose={onClose} title={<span className="inline-flex items-center gap-2"><SubjectTile subject={subject} size={28} />Colour for {subject}</span>} id="hub-subject-colour"
      footer={<button type="button" onClick={onClose} className={`hub-press min-h-[44px] rounded-full bg-[var(--brand)] px-5 text-[13px] font-extrabold text-white ${FOCUS}`}>Done</button>}>
      <p className="mb-3 text-[13px] leading-relaxed text-[var(--ink-2)]">Every card, chip and tile for {subject} in the Teaching Hub — and in My Classroom for your families — will use this colour.</p>
      <SwatchGrid subject={subject} value={value} onPick={pick} disabled={busy} />
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={reset} disabled={busy || isDefault} className={`min-h-[44px] rounded-full border border-[var(--line)] px-4 text-[12.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-40 ${FOCUS}`}>Use the default colour</button>
        {busy && <span className="text-[12px] font-semibold text-[var(--ink-2)]">Saving…</span>}
      </div>
      {err && <p role="alert" className="mt-3 rounded-lg bg-[var(--red-soft)] px-3 py-2 text-[12.5px] font-semibold text-[var(--red)]">{err}</p>}
    </Modal>
  );
}

const STANDARD_SUBJECTS = ["Maths", "English", "Science", "French", "Spanish", "German"];

/** Setup -> Teaching Hub: one row per subject (the six standard ones + whatever this hub has taught) with its swatches. Edits the Setup draft. */
export function SubjectColoursEditor({ colours, onChange }: { colours: Record<string, string>; onChange: (next: Record<string, string>) => void }) {
  const [mine, setMine] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    get<{ subject: string }[]>("/api/learning-hub/topics").then((t) => { if (live && Array.isArray(t)) setMine([...new Set(t.map((x) => x.subject).filter(Boolean))]); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  // The tiles in this list should show the DRAFT, not whatever colours the last hub screen published.
  useEffect(() => { applySubjectColours(colours); }, [colours]);
  const subjects = useMemo(() => {
    const seen = new Set<string>();
    return [...STANDARD_SUBJECTS, ...mine.sort((a, b) => a.localeCompare(b))].filter((s) => { const k = subjectColourKey(s); if (seen.has(k)) return false; seen.add(k); return true; });
  }, [mine]);
  return (
    <div className="grid gap-3" id="setup-subject-colours">
      {subjects.map((s) => {
        const k = subjectColourKey(s);
        const value = effectiveColourKey(s, colours);
        return (
          <div key={k} data-subject-row={s} className="flex flex-wrap items-center gap-3 border-b border-dashed border-[var(--line)] pb-3 last:border-b-0">
            <span className="flex min-w-[130px] items-center gap-2 text-[13px] font-extrabold text-[var(--ink)]"><SubjectTile subject={s} size={28} />{s}</span>
            <SwatchGrid subject={s} value={value} onPick={(key) => {
              const next = { ...colours };
              if (key === defaultColourKey(s)) delete next[k]; else next[k] = key;
              onChange(next);
            }} />
          </div>
        );
      })}
    </div>
  );
}
